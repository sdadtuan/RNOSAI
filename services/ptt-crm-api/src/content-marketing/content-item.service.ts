import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_BRIEF_WEIGHTS,
  briefCompleteness,
  briefScoreThreshold,
} from '../content-os-portfolio/brief-score.util';
import { evaluateItemRights } from '../content-os-portfolio/asset-rights.service';
import { evaluatePublishGate } from '../content-os-portfolio/publish-gate.util';
import {
  CONTENT_RESEARCH_BRIEF_KEY,
  stripContentResearchFromBrief,
} from '../market-research/content-insight-snapshot.util';
import { assertValidChannelFormat } from './content-marketing-channel.util';
import { ApprovalPackageService } from './approval-package.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import { emptyBodyJson } from './content-marketing.util';
import { assertProductionGateForPublish } from './content-production.util';
import { assertVisualGateForPublish } from './content-media.util';
import { assertTransition, publishFromStatuses } from './content-workflow.util';
import { diffMarkdownLines } from './content-version-diff.util';
import type { CmktBodyJson, CmktIdeaRow, CmktItemRow, CmktItemVersionRow, CmktVersionComparePayload } from './content-marketing.types';
import { AppConfigService } from '../config/app-config.service';
import { formatContentItemCode } from '../content-os-portfolio/content-os-portfolio.util';

@Injectable()
export class ContentItemService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly packages: ApprovalPackageService,
  ) {}

  async listItems(
    lifecycleId: number,
    filters: { status?: string; format?: string; assignee?: number },
  ): Promise<{ items: CmktItemRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const items = await this.repo.listItems(lifecycleId, filters);
    return { items };
  }

  async getItem(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    return item;
  }

  async createItem(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const channel = String(body.channel ?? '').trim();
    const format = String(body.format ?? '').trim();
    assertValidChannelFormat(channel, format);
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'title_required' });
    }
    const input: {
      title: string;
      channel: string;
      format: string;
      funnel_goal: string;
      idea_id: number | null;
      brief_json: Record<string, unknown>;
      body_json: CmktBodyJson;
      created_by: string;
      master_id?: number | null;
      display_code?: string;
    } = {
      title,
      channel,
      format,
      funnel_goal: String(body.funnel_goal ?? '').trim(),
      idea_id: body.idea_id != null ? Number(body.idea_id) : null,
      brief_json: (body.brief_json as Record<string, unknown>) ?? {},
      body_json: (body.body_json as CmktBodyJson) ?? emptyBodyJson(),
      created_by: actorEmail,
    };
    if (body.as_master === true) {
      const now = new Date();
      const seq = await this.repo.nextItemSeq(now);
      input.master_id = null;
      input.display_code = formatContentItemCode(now, seq);
    }
    return this.repo.createItem(lifecycleId, input);
  }

  async promoteMaster(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getItemById(lifecycleId, itemId);
    if (!existing) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    return this.repo.patchItem(lifecycleId, itemId, { master_id: null });
  }

  async listDeliverables(lifecycleId: number, itemId: number): Promise<{ items: CmktItemRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const current = await this.repo.getItemById(lifecycleId, itemId);
    if (!current) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    const items = await this.repo.listItems(lifecycleId, {});
    return {
      items: items.filter((row) => row.id === itemId || row.master_id === itemId),
    };
  }

  async createItemFromIdea(
    lifecycleId: number,
    idea: CmktIdeaRow,
    channel: string,
    format: string,
    actorEmail: string,
    opts?: { title?: string },
  ): Promise<CmktItemRow> {
    assertValidChannelFormat(channel, format);
    return this.repo.createItem(lifecycleId, {
      title: opts?.title?.trim() || idea.title,
      channel,
      format,
      funnel_goal: idea.target_goal,
      idea_id: idea.id,
      brief_json: { hook: idea.hook, ...(idea.meta_json ?? {}) },
      body_json: emptyBodyJson(),
      created_by: actorEmail,
    });
  }

  async patchItem(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getItemById(lifecycleId, itemId);
    if (!existing) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (existing.status === 'published' || existing.status === 'archived') {
      throw new BadRequestException({ error: 'item_locked', status: existing.status });
    }

    const patch: Record<string, unknown> = {};
    if (body.title != null) patch.title = String(body.title).trim();
    if (body.funnel_goal != null) patch.funnel_goal = String(body.funnel_goal).trim();
    if (body.brief_json != null) {
      if (existing.brief_locked_at && body.force_version !== true) {
        throw new ConflictException({ error: 'brief_locked' });
      }
      const stripped = stripContentResearchFromBrief(body.brief_json as Record<string, unknown>);
      const existingCite = (existing.brief_json ?? {})[CONTENT_RESEARCH_BRIEF_KEY];
      patch.brief_json =
        existingCite !== undefined
          ? { ...stripped, [CONTENT_RESEARCH_BRIEF_KEY]: existingCite }
          : stripped;
      patch.brief_score = briefCompleteness(
        patch.brief_json as Record<string, unknown>,
        DEFAULT_BRIEF_WEIGHTS,
      );
    }
    if (body.selected_variant_idx != null) {
      patch.selected_variant_idx = Number(body.selected_variant_idx);
    }
    if (body.channel != null || body.format != null) {
      const channel = String(body.channel ?? existing.channel);
      const format = String(body.format ?? existing.format);
      assertValidChannelFormat(channel, format);
      patch.channel = channel;
      patch.format = format;
    }

    let versionReason: string | null = null;
    const isBodyPatch =
      (body.apply_variant === true && body.selected_variant_idx != null) || body.body_json != null;
    if (isBodyPatch) {
      await this.packages.assertBodyNotLocked(itemId, body.force_version === true);
    }
    if (body.apply_variant === true && body.selected_variant_idx != null) {
      const idx = Number(body.selected_variant_idx);
      const variants = existing.body_json?.variants ?? [];
      if (idx < 0 || idx >= variants.length) {
        throw new BadRequestException({ error: 'invalid_variant_idx', idx, count: variants.length });
      }
      const hook = variants[idx];
      const rest = String(existing.body_json?.markdown ?? '').trim();
      patch.body_json = {
        ...existing.body_json,
        markdown: rest ? `${hook}\n\n${rest}` : hook,
        variants,
        html: existing.body_json?.html ?? '',
      };
      patch.selected_variant_idx = idx;
      versionReason = body.force_version === true ? 'package_force_version' : 'manual';
    } else if (body.body_json != null) {
      patch.body_json = body.body_json as CmktBodyJson;
      versionReason = body.force_version === true ? 'package_force_version' : 'manual';
    }

    const updated = await this.repo.patchItem(lifecycleId, itemId, patch);
    if (versionReason) {
      await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, versionReason);
    }
    if (isBodyPatch && body.force_version === true) {
      await this.packages.supersedeLatestSent(itemId);
    }
    if (existing.brief_locked_at && body.brief_json != null && body.force_version === true) {
      await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'brief_force_version');
    }
    return updated;
  }

  async lockBrief(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getItemById(lifecycleId, itemId);
    if (!existing) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    return this.repo.patchItem(lifecycleId, itemId, {
      brief_locked_at: new Date().toISOString(),
    });
  }

  async patchItemAssignees(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getItemById(lifecycleId, itemId);
    if (!existing) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (existing.status === 'published' || existing.status === 'archived') {
      throw new BadRequestException({ error: 'item_locked', status: existing.status });
    }

    const patch: Record<string, unknown> = {};
    if ('assignee_sp' in body) {
      patch.assignee_sp = await this.parseAssigneeId(body.assignee_sp);
    }
    if ('assignee_qa' in body) {
      patch.assignee_qa = await this.parseAssigneeId(body.assignee_qa);
    }
    if (!Object.keys(patch).length) {
      throw new BadRequestException({ error: 'assignee_required', message: 'Cần assignee_sp hoặc assignee_qa.' });
    }
    return this.repo.patchItem(lifecycleId, itemId, patch);
  }

  async compareItemVersions(
    lifecycleId: number,
    itemId: number,
    v1: number,
    v2: number,
  ): Promise<CmktVersionComparePayload> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 <= 0 || v2 <= 0) {
      throw new BadRequestException({ error: 'invalid_version', v1, v2 });
    }

    const [versionA, versionB] = await Promise.all([
      this.repo.getItemVersionByNo(itemId, v1),
      this.repo.getItemVersionByNo(itemId, v2),
    ]);
    if (!versionA || !versionB) {
      throw new NotFoundException({ error: 'version_not_found', v1, v2 });
    }

    const before = String(versionA.body_json?.markdown ?? '');
    const after = String(versionB.body_json?.markdown ?? '');
    const diff = diffMarkdownLines(before, after);
    return { item_id: itemId, v1, v2, lines: diff.lines };
  }

  private async parseAssigneeId(value: unknown): Promise<number | null> {
    if (value == null || value === '') return null;
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException({ error: 'invalid_assignee', value });
    }
    if (!(await this.repo.staffExists(id))) {
      throw new BadRequestException({ error: 'assignee_not_found', id });
    }
    return id;
  }

  async listItemVersions(lifecycleId: number, itemId: number): Promise<{ versions: CmktItemVersionRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    const versions = await this.repo.listItemVersions(itemId);
    return { versions };
  }

  async publishItem(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }

    assertTransition(item.status, publishFromStatuses(this.config.contentMarketingClientGate), 'publish');
    assertProductionGateForPublish(item);
    assertVisualGateForPublish(item, this.config.contentMarketingMediaEnabled);

    const rightsRows = await this.repo.listAssetRights(itemId);
    const score = item.brief_score ?? briefCompleteness(item.brief_json ?? {}, DEFAULT_BRIEF_WEIGHTS);
    const publishedUrlProvided = body.published_url != null;
    const publishedUrl = publishedUrlProvided ? String(body.published_url).trim() : null;
    const gate = evaluatePublishGate({
      briefReady: score >= briefScoreThreshold(item.risk_level),
      internalApproved: ['approved_internal', 'client_approved', 'pending_client', 'scheduled'].includes(
        item.status,
      ),
      legalRequired: false,
      legalApproved: false,
      clientApproved: this.config.contentMarketingClientGate
        ? ['client_approved', 'scheduled'].includes(item.status)
        : true,
      urlOk: publishedUrlProvided ? Boolean(publishedUrl) : true,
      ...evaluateItemRights(item.media_json, rightsRows),
    });
    if (gate.status === 'Blocked') {
      throw new ConflictException({ error: 'publish_gate_blocked', blockers: gate.blockers });
    }

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      status: 'published',
      published_at: new Date().toISOString(),
      published_url: publishedUrl || item.published_url,
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'publish');
    return updated;
  }
}
