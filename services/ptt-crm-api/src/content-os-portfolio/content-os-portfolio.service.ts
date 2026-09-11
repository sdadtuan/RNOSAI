import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentItemService } from '../content-marketing/content-item.service';
import { CMKT_CHANNELS } from '../content-marketing/content-marketing.constants';
import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import type {
  CmktCalendarSlotRow,
  CmktIdeaRow,
  CmktItemRow,
  CmktReviewQueueItem,
  CmktSlaAuditRow,
} from '../content-marketing/content-marketing.types';
import {
  pickConnectorPerChannel,
  resolveChannelHealth,
  type ChannelConnectorRow,
  type ChannelHealth,
} from './channel-health.util';
import {
  actionErrorCode,
  actorIsItemCreator,
  assertSameApproveStep,
  canApproveAsDelegate,
  isCmktSodEnabled,
  isDelegateExpired,
  packageDelegateTo,
  packageDelegateUntil,
  parseBatchItemIds,
  parseDelegateUntil,
} from './batch-approval.util';
import { ContentWorkflowService } from '../content-marketing/content-workflow.service';
import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';
import {
  CONTENT_REQUEST_SOURCES,
  emptyPortfolioCommandCenter,
  type ContentRequestRow,
  type ContentRequestSource,
  type PortfolioCommandCenter,
  type PortfolioCommandScope,
  type PortfolioProductionItem,
} from './content-os-portfolio.types';
import { formatContentRequestCode, requestCompleteness } from './content-os-portfolio.util';
import { toAiTraceRow, type AiTraceRow } from './ai-traces.util';
import type { CmktInsightRow } from './copilot-insights.util';
import {
  collectCopyText,
  matchGlossaryTerms,
  mergeGlossaryScope,
  resolveGlossaryScope,
  selectCopilotGlossary,
  type CmktGlossaryRow,
} from './copilot-glossary.util';
import { computeCapacity, criticalPathTaskIds, hasDelayedCriticalTask } from './production-capacity.util';
import { listDamOrEmpty, stubDamAdapter, type DamListResult } from './dam-adapter';
import {
  DIRECT_SOCIAL_PUBLISH_KEY,
  isMissingCmktSettingsSchema,
  resolveDirectSocialPublish,
} from './direct-social-publish.util';
import { resolveSsoEnforced, type StaffIdpSnapshot } from './sso-enforced.util';
import {
  AUDIT_EXPORT_ACTION,
  AUDIT_EXPORT_ENTITY,
  formatAuditExportCsv,
  isMissingAuditActivitySchema,
} from './audit-export.util';
import { assertHardDeleteOutcome } from './legal-hold.util';
import { parsePageAllowlist } from './fb-page-allowlist.util';
import { createOauthState } from './oauth-state.util';
import { buildFacebookAuthUrl, exchangeFacebookCode } from './facebook-oauth.util';

const OAUTH_CONNECT_ACTION = 'oauth_connect';
const OAUTH_DISCONNECT_ACTION = 'oauth_disconnect';
const FACEBOOK_PAGE_CHANNEL = 'facebook_page';

function facebookSettingsRedirect(status: 'ok' | 'error'): string {
  const origin = String(process.env.OPS_WEB_ORIGIN ?? '').replace(/\/$/, '');
  return `${origin}/crm/content-os/settings?fb=${status}`;
}

type PortfolioSettings = {
  direct_social_publish: boolean;
  sso_enforced: boolean;
};

function portfolioSettings(
  directSocialPublish: boolean,
  idp?: StaffIdpSnapshot | null,
): PortfolioSettings {
  return {
    direct_social_publish: directSocialPublish,
    sso_enforced: resolveSsoEnforced(idp),
  };
}

const PORTFOLIO_LIFECYCLE_CAP = 20;

function currentIsoWeekRange(now = new Date()): { from: string; to: string } {
  const day = now.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysFromMonday, 0, 0, 0, 0),
  );
  const sunday = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6, 23, 59, 59, 999),
  );
  return { from: monday.toISOString(), to: sunday.toISOString() };
}

@Injectable()
export class ContentOsPortfolioService {
  constructor(
    private readonly repo: ContentOsPortfolioRepository,
    private readonly workflow: ContentWorkflowService,
    private readonly marketingRepo: ContentMarketingRepository,
    private readonly items: ContentItemService,
    @Optional() private readonly config?: AppConfigService,
  ) {}

  private staffIdpSnapshot(): StaffIdpSnapshot {
    return {
      staffAuthMode: this.config?.staffAuthMode,
      staffKeycloakIssuer: this.config?.staffKeycloakIssuer,
    };
  }

  async getCommandCenter(scope: PortfolioCommandScope): Promise<PortfolioCommandCenter> {
    const staffId = scope.staffId ?? 0;
    if (!(staffId > 0)) {
      return emptyPortfolioCommandCenter();
    }
    const lifecycleIds = await this.repo.listScopedLifecycleIds(staffId);
    if (!lifecycleIds.length) {
      return emptyPortfolioCommandCenter();
    }
    const hint = scope.lifecycleHint;
    const ids = hint && hint > 0 && lifecycleIds.includes(hint) ? [hint] : lifecycleIds;
    const command = await this.repo.aggregateCommand(ids);
    const items = await this.loadProductionItems(ids);
    return this.withCapacityAndCriticalPath(command, items);
  }

  async listApprovals(scope: { staffId: number }): Promise<{ items: CmktReviewQueueItem[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    const items: CmktReviewQueueItem[] = [];
    for (const id of ids) {
      try {
        const result = await this.workflow.listReviewQueue(id, {});
        items.push(...(result.items ?? []));
      } catch {
        // disabled / missing lifecycle — skip
      }
    }
    return { items };
  }

  async batchApprove(input: {
    staffId: number;
    actor: string;
    item_ids: unknown;
    step?: string;
  }): Promise<{ ok: number[]; failed: Array<{ id: number; error: string }> }> {
    const ids = parseBatchItemIds(input.item_ids);
    const scoped = await this.scopedLifecycleIds(input.staffId);
    const failed: Array<{ id: number; error: string }> = [];
    const loaded: Array<{ id: number; item: CmktItemRow }> = [];
    for (const id of ids) {
      const item = await this.marketingRepo.findItemById(id);
      if (!item) {
        failed.push({ id, error: 'item_not_found' });
        continue;
      }
      if (!scoped.includes(item.lifecycle_id)) {
        failed.push({ id, error: 'lifecycle_out_of_scope' });
        continue;
      }
      loaded.push({ id, item });
    }
    if (loaded.length) {
      assertSameApproveStep(
        loaded.map((row) => row.item.status),
        input.step,
      );
    }
    const sodOn = isCmktSodEnabled();
    const ok: number[] = [];
    for (const { id, item } of loaded) {
      const pkg =
        typeof this.marketingRepo.getLatestApprovalPackage === 'function'
          ? await this.marketingRepo.getLatestApprovalPackage(id)
          : null;
      if (sodOn) {
        const versions =
          typeof this.marketingRepo.listItemVersions === 'function'
            ? await this.marketingRepo.listItemVersions(id)
            : [];
        const first = [...(versions ?? [])].sort((a, b) => a.version_no - b.version_no)[0];
        if (
          actorIsItemCreator(input.actor, {
            created_by: item.created_by,
            first_version_author: first?.changed_by ?? null,
            package_created_by: pkg?.created_by ?? null,
          })
        ) {
          failed.push({ id, error: 'sod_creator_cannot_final_approve' });
          continue;
        }
      }
      if (pkg) {
        const until = packageDelegateUntil(pkg);
        const delegateTo = packageDelegateTo(pkg);
        if (
          delegateTo &&
          actorIsItemCreator(input.actor, { created_by: delegateTo }) &&
          (isDelegateExpired(until) || !canApproveAsDelegate(until))
        ) {
          failed.push({ id, error: 'delegate_expired' });
          continue;
        }
      }
      try {
        await this.workflow.approve(item.lifecycle_id, id, input.actor);
        ok.push(id);
      } catch (err) {
        failed.push({ id, error: actionErrorCode(err) });
      }
    }
    return { ok, failed };
  }

  async delegateApproval(input: {
    staffId: number;
    actor: string;
    packageId: number;
    delegate_until: unknown;
    delegate_to?: string;
  }): Promise<{
    id: number;
    item_id: number;
    delegate_until: string;
    delegate_to?: string | null;
    delegate_expired: boolean;
    snapshot_json?: Record<string, unknown>;
  }> {
    const until = parseDelegateUntil(input.delegate_until);
    const pkg =
      typeof this.marketingRepo.getApprovalPackageById === 'function'
        ? await this.marketingRepo.getApprovalPackageById(input.packageId)
        : null;
    if (!pkg) {
      throw new NotFoundException({ error: 'package_not_found', id: input.packageId });
    }
    const scoped = await this.scopedLifecycleIds(input.staffId);
    const item = await this.marketingRepo.findItemById(pkg.item_id);
    if (!item || !scoped.includes(item.lifecycle_id)) {
      throw new ForbiddenException({ error: 'lifecycle_out_of_scope' });
    }
    const updated =
      typeof this.marketingRepo.updateApprovalPackageDelegate === 'function'
        ? await this.marketingRepo.updateApprovalPackageDelegate(pkg.id, {
            delegate_until: until,
            delegate_to: input.delegate_to,
          })
        : {
            ...pkg,
            delegate_until: until,
            snapshot_json: {
              ...pkg.snapshot_json,
              delegate_until: until,
              ...(input.delegate_to ? { delegate_to: input.delegate_to } : {}),
            },
          };
    const storedUntil = packageDelegateUntil(updated ?? { ...pkg, delegate_until: until }) ?? until;
    return {
      id: (updated ?? pkg).id,
      item_id: (updated ?? pkg).item_id,
      delegate_until: storedUntil,
      delegate_to: input.delegate_to ?? packageDelegateTo(updated ?? pkg),
      delegate_expired: isDelegateExpired(storedUntil),
      snapshot_json: (updated ?? pkg).snapshot_json as Record<string, unknown>,
    };
  }

  async listPublications(scope: {
    staffId: number;
    from?: string;
    to?: string;
  }): Promise<{
    slots: CmktCalendarSlotRow[];
    channel_health?: Array<{ channel: string } & ChannelHealth>;
  }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    const week = currentIsoWeekRange();
    const range = {
      from: scope.from?.trim() || week.from,
      to: scope.to?.trim() || week.to,
    };
    const slots: CmktCalendarSlotRow[] = [];
    for (const id of ids) {
      try {
        const rows = await this.marketingRepo.listCalendarSlots(id, range);
        slots.push(...(rows ?? []));
      } catch {
        // disabled / missing lifecycle — skip
      }
    }
    if (!ids.length) return { slots };
    const health = await this.getChannelHealth(scope);
    const byChannel = new Map(health.channels.map((row) => [row.channel, row]));
    return {
      slots: slots.map((slot) => {
        const channel = slot.item?.channel ?? '';
        const match = byChannel.get(channel);
        return {
          ...slot,
          channel_health: match
            ? { status: match.status, ...(match.expires_at ? { expires_at: match.expires_at } : {}) }
            : { status: 'Manual' },
        };
      }),
      channel_health: health.channels,
    };
  }

  async getChannelHealth(_scope: { staffId: number }): Promise<{
    channels: Array<{ channel: string } & ChannelHealth>;
  }> {
    const connectors = await this.loadChannelConnectors();
    const byChannel = pickConnectorPerChannel(connectors);
    return {
      channels: CMKT_CHANNELS.map((channel) => ({
        channel,
        ...resolveChannelHealth(byChannel.get(channel) ?? null),
      })),
    };
  }

  async listChannelAccounts(scope: { staffId: number }): Promise<{
    items: Array<{
      id: number;
      channel: string;
      display_name: string;
      account_ref: string;
      health: ChannelHealth;
    }>;
  }> {
    const lifecycleIds = await this.scopedLifecycleIds(scope.staffId);
    if (!lifecycleIds.length || typeof this.repo.listChannelAccountsPublic !== 'function') {
      return { items: [] };
    }
    const rows = await this.repo.listChannelAccountsPublic(lifecycleIds);
    const grouped = new Map<
      number,
      {
        id: number;
        channel: string;
        display_name: string;
        account_ref: string;
        connectors: ChannelConnectorRow[];
      }
    >();
    for (const row of rows ?? []) {
      const id = Number(row.id);
      let entry = grouped.get(id);
      if (!entry) {
        entry = {
          id,
          channel: String(row.channel ?? ''),
          display_name: String(row.display_name ?? ''),
          account_ref: String(row.account_ref ?? ''),
          connectors: [],
        };
        grouped.set(id, entry);
      }
      entry.connectors.push({
        channel: String(row.channel ?? entry.channel),
        status: row.status != null ? String(row.status) : null,
        expires_at: row.expires_at != null ? String(row.expires_at) : null,
      });
    }
    return {
      items: [...grouped.values()].map((entry) => {
        const picked = pickConnectorPerChannel(entry.connectors);
        return {
          id: entry.id,
          channel: entry.channel,
          display_name: entry.display_name,
          account_ref: entry.account_ref,
          health: resolveChannelHealth(picked.get(entry.channel) ?? null),
        };
      }),
    };
  }

  async disconnectConnector(input: {
    staffId: number;
    connectorId: number;
    actor: string;
  }): Promise<{ status: 'off' }> {
    const lifecycleIds = await this.scopedLifecycleIds(input.staffId);
    const connector =
      typeof this.repo.getConnectorById === 'function'
        ? await this.repo.getConnectorById(input.connectorId, lifecycleIds)
        : null;
    if (!connector) {
      throw new NotFoundException({ error: 'connector_not_found' });
    }
    await this.repo.clearConnectorSecrets(input.connectorId);
    if (typeof this.repo.insertAuditExport === 'function') {
      await this.repo.insertAuditExport({
        actor: input.actor,
        action: OAUTH_DISCONNECT_ACTION,
        entity: `${connector.channel ?? FACEBOOK_PAGE_CHANNEL}:${connector.id}`,
      });
    }
    return { status: 'off' };
  }

  async listDamAssets(scope: { staffId: number; collection?: string }): Promise<DamListResult> {
    return listDamOrEmpty(stubDamAdapter(), { collection: scope.collection });
  }

  async getSettings(_scope: { staffId: number }): Promise<PortfolioSettings> {
    if (typeof this.repo.ensurePgReady === 'function' && !(await this.repo.ensurePgReady())) {
      throw new ServiceUnavailableException({ error: 'postgres_not_ready' });
    }
    if (typeof this.repo.getSetting !== 'function') {
      return portfolioSettings(false, this.staffIdpSnapshot());
    }
    try {
      const row = (await this.repo.getSetting(DIRECT_SOCIAL_PUBLISH_KEY)) ?? null;
      return portfolioSettings(resolveDirectSocialPublish(row), this.staffIdpSnapshot());
    } catch (err) {
      if (isMissingCmktSettingsSchema(err)) {
        return portfolioSettings(false, this.staffIdpSnapshot());
      }
      throw err;
    }
  }

  async patchSettings(input: {
    staffId: number;
    actor: string;
    body: Record<string, unknown>;
  }): Promise<PortfolioSettings> {
    const value = input.body?.direct_social_publish;
    if (typeof value !== 'boolean') {
      throw new BadRequestException({ error: 'direct_social_publish_invalid' });
    }
    if (typeof this.repo.upsertSetting === 'function') {
      await this.repo.upsertSetting(DIRECT_SOCIAL_PUBLISH_KEY, value, input.actor);
    }
    return portfolioSettings(value, this.staffIdpSnapshot());
  }

  async exportAuditCsv(input: { staffId: number; actor: string }): Promise<string> {
    if (typeof this.repo.ensurePgReady === 'function' && !(await this.repo.ensurePgReady())) {
      throw new ServiceUnavailableException({ error: 'postgres_not_ready' });
    }
    if (typeof this.repo.insertAuditExport !== 'function') {
      throw new ServiceUnavailableException({ error: 'audit_export_failed' });
    }
    try {
      await this.repo.insertAuditExport({
        actor: input.actor,
        action: AUDIT_EXPORT_ACTION,
        entity: AUDIT_EXPORT_ENTITY,
      });
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException({ error: 'audit_export_failed' });
    }
    const scoped = await this.scopedLifecycleIds(input.staffId);
    try {
      const rows =
        typeof this.repo.listAuditActivity === 'function' ? await this.repo.listAuditActivity(scoped) : [];
      return formatAuditExportCsv(rows ?? []);
    } catch (err) {
      if (isMissingAuditActivitySchema(err)) return formatAuditExportCsv([]);
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException({ error: 'audit_export_failed' });
    }
  }

  async hardDeleteItem(input: { staffId: number; itemId: number; actor: string }): Promise<{
    ok: true;
    id: number;
  }> {
    const scoped = await this.scopedLifecycleIds(input.staffId);
    const outcome =
      typeof this.repo.hardDeleteItem === 'function'
        ? await this.repo.hardDeleteItem({
            itemId: input.itemId,
            actor: input.actor,
            lifecycleIds: scoped,
          })
        : 'missing';
    return assertHardDeleteOutcome(outcome, input.itemId);
  }

  async listRequests(scope: { staffId: number }): Promise<{ items: ContentRequestRow[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    if (!ids.length) return { items: [] };
    let items: ContentRequestRow[] = [];
    try {
      items = (await this.repo.listRequests(ids)) ?? [];
    } catch {
      items = [];
    }
    const ideas = await this.listUnconvertedIdeaItems(ids);
    return { items: [...items, ...ideas] };
  }

  async createRequest(input: {
    staffId: number;
    lifecycleId: number;
    actor: string;
    body: Record<string, unknown>;
  }): Promise<ContentRequestRow> {
    if (!Number.isFinite(input.lifecycleId) || input.lifecycleId <= 0) {
      throw new BadRequestException({ error: 'invalid_lifecycle_id' });
    }
    const scoped = await this.scopedLifecycleIds(input.staffId);
    if (!scoped.includes(input.lifecycleId)) {
      throw new ForbiddenException({ error: 'lifecycle_out_of_scope' });
    }
    const deliverable_ask = String(input.body.deliverable_ask ?? '').trim();
    if (!deliverable_ask) {
      throw new BadRequestException({ error: 'deliverable_ask_required' });
    }
    const source = this.parseRequestSource(input.body.source);
    const client_label = String(input.body.client_label ?? '').trim();
    const brand_label = String(input.body.brand_label ?? '').trim();
    const objective = String(input.body.objective ?? '').trim();
    const due_at = String(input.body.due_at ?? '').trim() || null;
    const priority = String(input.body.priority ?? '').trim() || 'Standard';
    const completeness = requestCompleteness({
      client: client_label,
      brand: brand_label,
      deliverable: deliverable_ask,
      objective,
      due: due_at ?? '',
      source,
    });
    const now = new Date();
    const seq = await this.repo.nextRequestSeq(now);
    const display_code = formatContentRequestCode(now, seq);
    return this.repo.insertRequest({
      lifecycle_id: input.lifecycleId,
      display_code,
      source,
      requester_email: input.actor,
      client_label,
      brand_label,
      deliverable_ask,
      objective,
      due_at,
      priority,
      completeness,
      triage_status: 'Submitted',
      created_by: input.actor,
    });
  }

  async convertRequest(input: {
    staffId: number;
    requestId: number;
    actor: string;
    body: Record<string, unknown>;
  }): Promise<{ request: ContentRequestRow; item: CmktItemRow & { request_id: number; display_code: string } }> {
    const request = await this.repo.getRequestById(input.requestId);
    if (!request) {
      throw new NotFoundException({ error: 'request_not_found', id: input.requestId });
    }
    const scoped = await this.scopedLifecycleIds(input.staffId);
    if (!scoped.includes(request.lifecycle_id)) {
      throw new ForbiddenException({ error: 'lifecycle_out_of_scope' });
    }
    if (request.triage_status !== 'Accepted') {
      throw new BadRequestException({ error: 'request_not_accepted', status: request.triage_status });
    }
    const channel = String(input.body.channel ?? 'facebook').trim() || 'facebook';
    const format = String(input.body.format ?? 'social_post').trim() || 'social_post';
    const item = await this.items.createItem(
      request.lifecycle_id,
      { title: request.deliverable_ask, channel, format, as_master: true },
      input.actor,
    );
    const linked = await this.repo.updateItemRequestLink(item.id, {
      request_id: request.id,
    });
    const converted = await this.repo.updateRequestStatus(request.id, 'Converted');
    return {
      request: converted,
      item: {
        ...item,
        request_id: linked.request_id,
        display_code: linked.display_code || item.display_code || '',
      },
    };
  }

  async listInsights(scope: {
    staffId: number;
    lifecycleHint?: number;
  }): Promise<{ items: CmktInsightRow[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    if (!ids.length) return { items: [] };
    const hint = scope.lifecycleHint;
    const scoped = hint && hint > 0 && ids.includes(hint) ? [hint] : ids;
    const items = (await this.repo.listInsights(scoped, ['Draft', 'Approved'])) ?? [];
    return { items };
  }

  async listSlaEvents(scope: {
    staffId: number;
    itemId?: number;
    amStaffId?: number;
  }): Promise<{ items: CmktSlaAuditRow[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    if (!ids.length) return { items: [] };

    if (scope.itemId != null) {
      const item = await this.marketingRepo.findItemById(scope.itemId);
      if (!item || !ids.includes(item.lifecycle_id)) return { items: [] };
    }

    const rows = await this.marketingRepo.listSlaAudits({
      item_id: scope.itemId,
      am_staff_id: scope.amStaffId,
    });
    if (!rows.length) return { items: [] };

    const uniqueIds = [...new Set(rows.map((row) => row.item_id))];
    const allowed = new Set<number>();
    for (const itemId of uniqueIds) {
      const found = await this.marketingRepo.findItemById(itemId);
      if (found && ids.includes(found.lifecycle_id)) allowed.add(itemId);
    }
    return { items: rows.filter((row) => allowed.has(row.item_id)) };
  }

  async listGlossary(scope: {
    staffId: number;
    lifecycleHint?: number;
  }): Promise<{ items: CmktGlossaryRow[] }> {
    const ids = await this.scopedLifecycleIds(scope.staffId);
    if (!ids.length) return { items: [] };
    const hint = scope.lifecycleHint;
    const scoped = hint && hint > 0 && ids.includes(hint) ? [hint] : ids;
    const items = (await this.repo.listGlossary(scoped, ['Draft', 'Approved'])) ?? [];
    return { items };
  }

  async approveGlossary(input: { staffId: number; glossaryId: number }): Promise<CmktGlossaryRow> {
    const row = await this.repo.getGlossaryById(input.glossaryId);
    if (!row) {
      throw new NotFoundException({ error: 'glossary_not_found', id: input.glossaryId });
    }
    const scoped = await this.scopedLifecycleIds(input.staffId);
    if (!scoped.includes(row.lifecycle_id)) {
      throw new ForbiddenException({ error: 'lifecycle_out_of_scope' });
    }
    if (row.status !== 'Draft') {
      throw new ConflictException({ error: 'glossary_not_draft', status: row.status });
    }
    try {
      return await this.repo.updateGlossaryStatus(row.id, 'Approved');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.startsWith('glossary_not_found')) {
        throw new NotFoundException({ error: 'glossary_not_found', id: input.glossaryId });
      }
      if (message.startsWith('glossary_not_draft')) {
        throw new ConflictException({ error: 'glossary_not_draft', status: row.status });
      }
      throw err;
    }
  }

  async approveInsight(input: { staffId: number; insightId: number }): Promise<CmktInsightRow> {
    const insight = await this.repo.getInsightById(input.insightId);
    if (!insight) {
      throw new NotFoundException({ error: 'insight_not_found', id: input.insightId });
    }
    const scoped = await this.scopedLifecycleIds(input.staffId);
    if (!scoped.includes(insight.lifecycle_id)) {
      throw new ForbiddenException({ error: 'lifecycle_out_of_scope' });
    }
    if (insight.status !== 'Draft') {
      throw new ConflictException({ error: 'insight_not_draft', status: insight.status });
    }
    try {
      return await this.repo.updateInsightStatus(insight.id, 'Approved');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.startsWith('insight_not_found')) {
        throw new NotFoundException({ error: 'insight_not_found', id: input.insightId });
      }
      if (message.startsWith('insight_not_draft')) {
        throw new ConflictException({ error: 'insight_not_draft', status: insight.status });
      }
      throw err;
    }
  }

  async listAiTraces(input: {
    staffId: number;
    itemId: number;
    lifecycleHint?: number;
  }): Promise<{ items: AiTraceRow[] }> {
    await this.getPortfolioItem(input);
    const jobs = (await this.repo.listAiTraceJobs(input.itemId)) ?? [];
    return { items: jobs.map((job) => toAiTraceRow(job, job.run)) };
  }

  async getPortfolioItem(input: {
    staffId: number;
    itemId: number;
    lifecycleHint?: number;
  }): Promise<CmktItemRow> {
    const ids = await this.scopedLifecycleIds(input.staffId);
    if (!ids.length) {
      throw new NotFoundException({ error: 'item_not_found', id: input.itemId });
    }
    const hint = input.lifecycleHint;
    if (hint && ids.includes(hint)) {
      try {
        return this.withGlossaryHits(this.withCriticalPath(await this.items.getItem(hint, input.itemId)));
      } catch {
        // hint missed — scan scoped items
      }
    }
    const found = await this.marketingRepo.findItemById(input.itemId);
    if (!found || !ids.includes(found.lifecycle_id)) {
      throw new NotFoundException({ error: 'item_not_found', id: input.itemId });
    }
    return this.withGlossaryHits(
      this.withCriticalPath(await this.items.getItem(found.lifecycle_id, input.itemId)),
    );
  }

  private async loadProductionItems(ids: number[]): Promise<PortfolioProductionItem[]> {
    if (!ids.length) return [];
    if (typeof this.repo.listScopedProductionItems !== 'function') return [];
    return (await this.repo.listScopedProductionItems(ids)) ?? [];
  }

  private withCapacityAndCriticalPath(
    command: PortfolioCommandCenter,
    items: PortfolioProductionItem[],
  ): PortfolioCommandCenter {
    const cap = computeCapacity(items);
    const risk_queue = command.risk_queue.map((row) => {
      const match = items.find((item) => item.id === row.item_id);
      if (!match || !hasDelayedCriticalTask(match.production_json?.tasks)) return row;
      return { ...row, risk_signal: 'CRITICAL_PATH_DELAYED' };
    });
    const seen = new Set(risk_queue.map((row) => row.item_id));
    for (const item of items) {
      if (item.id == null || seen.has(item.id) || !hasDelayedCriticalTask(item.production_json?.tasks)) continue;
      risk_queue.push({
        item_id: item.id,
        lifecycle_id: item.lifecycle_id ?? 0,
        content_code: null,
        title: item.title ?? '',
        client_label: null,
        risk_signal: 'CRITICAL_PATH_DELAYED',
        owner_label: null,
        sla_remaining_h: null,
        recommended_action: 'Gỡ block trên critical path',
      });
    }
    return {
      ...command,
      capacity_pct: cap.capacity_pct,
      capacity_band: cap.capacity_band,
      risk_queue,
    };
  }

  private withCriticalPath(item: CmktItemRow): CmktItemRow {
    const critical_path_task_ids = criticalPathTaskIds(item.production_json?.tasks);
    return critical_path_task_ids.length ? { ...item, critical_path_task_ids } : item;
  }

  private async withGlossaryHits(item: CmktItemRow): Promise<CmktItemRow> {
    if (typeof this.repo.listGlossaryForLifecycle !== 'function') return item;
    const rows = await this.repo.listGlossaryForLifecycle(item.lifecycle_id).catch(() => []);
    const snapshot =
      typeof this.marketingRepo.getActiveSnapshotSummary === 'function'
        ? await this.marketingRepo.getActiveSnapshotSummary(item.lifecycle_id).catch(() => null)
        : null;
    const brandContext =
      snapshot?.brand_context_json &&
      typeof snapshot.brand_context_json === 'object' &&
      !Array.isArray(snapshot.brand_context_json)
        ? snapshot.brand_context_json
        : {};
    const approved = selectCopilotGlossary(
      rows,
      new Date(),
      mergeGlossaryScope(
        resolveGlossaryScope(item as unknown as Record<string, unknown>),
        resolveGlossaryScope(brandContext),
      ),
    );
    const glossary_hits = matchGlossaryTerms(
      collectCopyText(item.body_json),
      approved.map((row) => row.term),
    );
    return { ...item, glossary_hits };
  }

  async startFacebookOAuth(input: { staffId: number; lifecycleHint?: number }): Promise<{ redirect: string }> {
    const appId = String(process.env.CMKT_FB_APP_ID ?? '').trim();
    const redirectUri = String(process.env.CMKT_FB_REDIRECT_URI ?? '').trim();
    if (!appId || !redirectUri) {
      throw new ServiceUnavailableException({ error: 'facebook_oauth_not_configured' });
    }
    const scoped = await this.scopedLifecycleIds(input.staffId);
    const hint = input.lifecycleHint;
    const lifecycleId = hint && hint > 0 && scoped.includes(hint) ? hint : scoped[0];
    if (!lifecycleId) {
      throw new ForbiddenException({ error: 'lifecycle_out_of_scope' });
    }
    const state = createOauthState();
    await this.repo.insertOauthState({
      state,
      staffId: input.staffId,
      lifecycleId,
    });
    return {
      redirect: buildFacebookAuthUrl({ appId, redirectUri, state }),
    };
  }

  async facebookOAuthCallback(input: { code?: string; state?: string }): Promise<{ redirect: string }> {
    try {
      const code = String(input.code ?? '').trim();
      const state = String(input.state ?? '').trim();
      if (!code || !state) {
        return { redirect: facebookSettingsRedirect('error') };
      }
      const consumed =
        typeof this.repo.consumeOauthState === 'function' ? await this.repo.consumeOauthState(state) : null;
      if (!consumed) {
        return { redirect: facebookSettingsRedirect('error') };
      }
      const appId = String(process.env.CMKT_FB_APP_ID ?? '').trim();
      const appSecret = String(process.env.CMKT_FB_APP_SECRET ?? '').trim();
      const redirectUri = String(process.env.CMKT_FB_REDIRECT_URI ?? '').trim();
      if (!appId || !appSecret || !redirectUri) {
        return { redirect: facebookSettingsRedirect('error') };
      }
      const exchanged = await exchangeFacebookCode(
        {
          code,
          redirectUri,
          appId,
          appSecret,
          allowlist: parsePageAllowlist(process.env.CMKT_FB_PAGE_ALLOWLIST),
        },
        fetch,
      );
      await this.repo.saveConnectorSecrets({
        lifecycleId: consumed.lifecycleId,
        pageId: exchanged.page_id,
        accessToken: exchanged.access_token,
        expiresAt: exchanged.expires_at,
        channel: FACEBOOK_PAGE_CHANNEL,
      });
      try {
        if (typeof this.repo.insertAuditExport === 'function') {
          await this.repo.insertAuditExport({
            actor: `staff:${consumed.staffId}`,
            action: OAUTH_CONNECT_ACTION,
            entity: `${FACEBOOK_PAGE_CHANNEL}:${exchanged.page_id}`,
          });
        }
      } catch {
        // Tokens already persisted; audit must not flip the user to ?fb=error.
      }
      return { redirect: facebookSettingsRedirect('ok') };
    } catch {
      return { redirect: facebookSettingsRedirect('error') };
    }
  }

  private parseRequestSource(raw: unknown): ContentRequestSource {
    if (raw === undefined) return 'account';
    const source = String(raw).trim();
    if ((CONTENT_REQUEST_SOURCES as readonly string[]).includes(source)) {
      return source as ContentRequestSource;
    }
    throw new BadRequestException({ error: 'invalid_source', source });
  }

  private async loadChannelConnectors(): Promise<ChannelConnectorRow[]> {
    if (typeof this.marketingRepo.listChannelConnectors !== 'function') return [];
    try {
      return (await this.marketingRepo.listChannelConnectors()) ?? [];
    } catch {
      return [];
    }
  }

  private async scopedLifecycleIds(staffId: number): Promise<number[]> {
    if (!(staffId > 0)) return [];
    const ids = await this.repo.listScopedLifecycleIds(staffId);
    return ids.slice(0, PORTFOLIO_LIFECYCLE_CAP);
  }

  private async listUnconvertedIdeaItems(ids: number[]): Promise<ContentRequestRow[]> {
    const items: ContentRequestRow[] = [];
    for (const id of ids) {
      try {
        const ideas = await this.marketingRepo.listIdeas(id, {});
        for (const idea of ideas ?? []) {
          if (idea.status === 'converted' || idea.status === 'archived') continue;
          items.push(this.ideaToRequestRow(idea));
        }
      } catch {
        // disabled / missing lifecycle — skip
      }
    }
    return items;
  }

  private ideaToRequestRow(idea: CmktIdeaRow): ContentRequestRow {
    return {
      id: idea.id,
      lifecycle_id: idea.lifecycle_id,
      display_code: `IDEA-${idea.id}`,
      kind: 'idea',
      source: 'idea',
      requester_email: idea.created_by ?? '',
      client_label: '',
      brand_label: '',
      deliverable_ask: idea.title,
      objective: idea.target_goal ?? '',
      due_at: null,
      priority: '',
      risk_level: '',
      completeness: 0,
      effort_h: null,
      tier: null,
      triage_status: idea.status,
      idea_id: idea.id,
      created_by: idea.created_by ?? '',
      created_at: idea.created_at ?? '',
      updated_at: idea.updated_at ?? '',
    };
  }
}
