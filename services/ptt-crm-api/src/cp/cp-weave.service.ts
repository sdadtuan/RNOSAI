import { createHash } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { CampaignWritesService } from '../campaign-writes/campaign-writes.service';
import { CreativesService } from '../creatives/creatives.service';
import { selectTextGen } from '../video-sop/adapters/i-text-gen';
import { insertProviderRun } from './cp-provider-runs.repository';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { probeMediaFile } from './cp-media-probe.util';
import { CpProjectsService, CpProjectScope } from './cp-projects.service';
import { CpPublishService } from './cp-publish.service';
import { assertNotQcBlocked } from './cp-qc.service';
import { CpSopIngestService } from './cp-sop-ingest.service';
import { CpVideoScope } from './cp-videos.service';
import { normalizeWeaveBrief } from './cp-weave-brief.util';
import {
  applyWeaveWatermark,
  durationMsFromProbe,
  guessMime,
  shouldIngestLane,
  verifyWeaveWebhookSign,
  watermarkForLane,
  type CpWeaveIngestResult,
  type CpWeaveStoragePort,
} from './cp-weave-ingest.util';
import { createDiskWeaveStorage } from './cp-weave-ingest.util';
import { buildWeaveOpenUrl } from './cp-weave-open.util';
import { nextWeaveTaskId, parseWeaveExportKey, parseWeaveFileName } from './cp-weave-path.util';
import { CP_WEAVE_QUERY, CpWeaveQueryPort } from './cp-weave.repository';
import {
  canTransitionWeave,
  type CpWeaveBrief,
  type CpWeaveLane,
  type CpWeaveStatus,
} from './cp-weave.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORMAT_BY_TEMPLATE: Record<string, CpWeaveBrief['output_format']> = {
  'feed-1x1': { kind: 'image', width: 1080, height: 1080 },
  'reel-9x16': { kind: 'video', width: 1080, height: 1920 },
  'banner-wide': { kind: 'image', width: 1920, height: 1080 },
};

export const CP_WEAVE_RUNTIME = 'CP_WEAVE_RUNTIME';

export type CpWeaveCreateInput = {
  project_id?: string;
  template_key?: string;
  deliverable_id?: string | null;
};

export type CpWeaveReviewScope = {
  scope?: CpProjectScope['scope'] | CpVideoScope['scope'];
  staffId?: number;
  teamIds?: number[];
};

export type CpWeaveRuntime = {
  generateBrief?: (ctx: Record<string, unknown>) => Promise<unknown>;
  sopIngest?: Pick<CpSopIngestService, 'ingestFromSop'>;
  projects?: Pick<CpProjectsService, 'submitCreative'>;
  campaignWrites?: Pick<CampaignWritesService, 'submit'>;
  publish?: Pick<CpPublishService, 'deliver'>;
};

export type CpWeaveHandoff = {
  kind: 'campaign_write' | 'cp_publish' | 'skipped';
  ok: boolean;
  skip_reason?: string;
  request_id?: string;
};

@Injectable()
export class CpWeaveService {
  private readonly runtime?: CpWeaveRuntime;

  constructor(
    @Inject(CP_WEAVE_QUERY) private readonly db: CpWeaveQueryPort,
    @Optional() private readonly storage?: CpWeaveStoragePort,
    @Optional() private readonly creatives?: CreativesService,
    @Optional() @Inject(CP_WEAVE_RUNTIME) runtime?: CpWeaveRuntime,
    @Optional() private readonly projects?: CpProjectsService,
    @Optional() private readonly sopIngest?: CpSopIngestService,
    @Optional() private readonly campaignWrites?: CampaignWritesService,
    @Optional() private readonly publish?: CpPublishService,
  ) {
    this.runtime = isWeaveRuntime(runtime) ? runtime : undefined;
  }

  async create(input: CpWeaveCreateInput, staffId: number) {
    this.assertEnabled();
    const projectId = requiredUuid(input.project_id, 'project_id_required');
    const templateKey = String(input.template_key ?? '').trim();
    if (!templateKey) cpThrow(400, { error: 'template_key_required' });

    const project = await this.loadProject(projectId);
    const template = await this.loadTemplate(templateKey);
    const clientCode = await this.loadClientCode(String(project.agency_client_id));
    const campaignCode = await this.loadCampaignCode(
      project.lifecycle_id == null ? null : String(project.lifecycle_id),
    );
    const taskId = await this.nextTaskId();
    const exportPrefix = process.env.WEAVE_EXPORT_PREFIX?.trim() || null;

    const inserted = await this.db.query(
      `INSERT INTO crm_cp_weave_work_orders (
         project_id, lifecycle_id, agency_client_id, deliverable_id, template_key,
         status, task_id, client_code, campaign_code, export_prefix, created_by_staff_id
       ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, 'draft', $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        projectId,
        project.lifecycle_id ?? null,
        project.agency_client_id,
        input.deliverable_id ?? null,
        template.template_key,
        taskId,
        clientCode,
        campaignCode,
        exportPrefix,
        staffId,
      ],
    );
    return inserted.rows[0] ?? { task_id: taskId, status: 'draft', project_id: projectId };
  }

  async list(projectId: string) {
    this.assertEnabled();
    const id = requiredUuid(projectId, 'project_id_required');
    const result = await this.db.query(
      `SELECT * FROM crm_cp_weave_work_orders
        WHERE project_id = $1::uuid
        ORDER BY created_at DESC`,
      [id],
    );
    return { items: result.rows };
  }

  async get(id: string) {
    this.assertEnabled();
    const wo = await this.loadWorkOrder(id);
    const assets = await this.db.query(
      `SELECT * FROM crm_cp_weave_assets WHERE work_order_id = $1::uuid ORDER BY created_at`,
      [wo.id],
    );
    return { ...wo, assets: assets.rows };
  }

  async generateBrief(id: string): Promise<Record<string, unknown> & { brief_json: CpWeaveBrief; ai_stub: boolean; status: string }> {
    this.assertEnabled();
    const wo = await this.loadWorkOrder(id);
    if (wo.status === 'draft' && !canTransitionWeave('draft', 'brief_ready')) {
      cpThrow(409, { error: 'illegal_weave_transition', from: wo.status, to: 'brief_ready' });
    }
    if (wo.status !== 'draft' && wo.status !== 'brief_ready') {
      cpThrow(409, { error: 'illegal_weave_transition', from: wo.status, to: 'brief_ready' });
    }

    const aiEnabled = isFlagOn(process.env.CP_AI_ENABLED);
    const { brief, aiStub } = await this.resolveBrief(wo, aiEnabled);
    const updated = await this.db.query(
      `UPDATE crm_cp_weave_work_orders
          SET brief_json = $2::jsonb,
              status = 'brief_ready',
              updated_at = now()
        WHERE id = $1::uuid
        RETURNING *`,
      [wo.id, JSON.stringify(brief)],
    );
    const row = updated.rows[0] ?? { ...wo, status: 'brief_ready', brief_json: brief };
    return {
      ...row,
      status: String(row.status ?? 'brief_ready'),
      brief_json: brief,
      ai_stub: aiStub,
    };
  }

  async open(id: string, staffId: number) {
    this.assertEnabled();
    const wo = await this.loadWorkOrder(id);
    this.assertTransition(wo.status as CpWeaveStatus, 'opened');
    const template = await this.loadTemplate(String(wo.template_key));
    const built = buildWeaveOpenUrl({
      base: process.env.WEAVE_OPEN_BASE?.trim() || 'https://app.weavy.ai/',
      templateUrl: String(template.weave_flow_url ?? '') || null,
      workOrderId: String(wo.id),
      projectId: String(wo.project_id),
    });
    await this.db.query(
      `UPDATE crm_cp_weave_work_orders
          SET status = 'opened',
              opened_at = now(),
              opened_by_staff_id = $2,
              updated_at = now()
        WHERE id = $1::uuid
        RETURNING *`,
      [wo.id, staffId],
    );
    return { href: built.href, copied_brief: built.copied_brief, status: 'opened' };
  }

  async syncOutput(
    workOrderId: string,
    opts?: { include_drafts?: boolean },
  ): Promise<CpWeaveIngestResult> {
    this.assertEnabled();
    const wo = await this.loadWorkOrder(workOrderId);
    const prefix = `${wo.client_code}/${wo.campaign_code}/${wo.task_id}/`;
    const storage = this.resolveStorage();
    const keys = await storage.list(prefix);
    const result: CpWeaveIngestResult = {
      scanned: keys.length,
      ingested: 0,
      skipped: 0,
      warnings: [],
      assets: [],
    };
    let linked = false;
    for (const key of keys) {
      const parsed = parseWeaveExportKey(key);
      if (!parsed) {
        result.skipped += 1;
        result.warnings.push(`skip ${key}`);
        continue;
      }
      if (!parseWeaveFileName(parsed.fileName)) {
        result.skipped += 1;
        result.warnings.push(`skip ${key}: invalid filename ${parsed.fileName}`);
        continue;
      }
      if (parsed.lane === 'source') {
        const catalog = await this.ingestParsed(wo, parsed, key, storage);
        if (catalog.status === 'ingested') {
          result.ingested += 1;
          if (catalog.asset) result.assets.push(catalog.asset);
        } else {
          result.skipped += 1;
          if (catalog.status === 'duplicate') result.warnings.push(`duplicate ${key}`);
        }
        continue;
      }
      if (!shouldIngestLane(parsed.lane, opts?.include_drafts === true)) {
        result.skipped += 1;
        continue;
      }
      const outcome = await this.ingestParsed(wo, parsed, key, storage);
      if (outcome.status === 'ingested') {
        result.ingested += 1;
        linked = true;
        if (outcome.asset) result.assets.push(outcome.asset);
      } else {
        result.skipped += 1;
        if (outcome.status === 'duplicate') result.warnings.push(`duplicate ${key}`);
      }
    }
    if (linked) {
      await this.markLinked(wo);
      await this.recordProviderRun(String(wo.id), String(wo.project_id ?? ''));
    }
    return result;
  }

  async ingestKey(
    storageKey: string,
    storage = this.resolveStorage(),
  ): Promise<'ingested' | 'duplicate' | 'skipped'> {
    this.assertEnabled();
    const parsed = parseWeaveExportKey(storageKey);
    if (!parsed || !parseWeaveFileName(parsed.fileName)) return 'skipped';
    if (parsed.lane !== 'source' && !shouldIngestLane(parsed.lane, false)) return 'skipped';
    const found = await this.db.query(
      `SELECT * FROM crm_cp_weave_work_orders WHERE task_id = $1 LIMIT 1`,
      [parsed.taskId],
    );
    const wo = found.rows[0];
    if (!wo) return 'skipped';
    const outcome = await this.ingestParsed(wo, parsed, storageKey, storage);
    if (outcome.status === 'ingested' && parsed.lane !== 'source') {
      await this.markLinked(wo);
      await this.recordProviderRun(String(wo.id), String(wo.project_id ?? ''));
    }
    return outcome.status;
  }

  async ingestHook(rawBody: string, signature: string | undefined) {
    this.assertEnabled();
    const secret = process.env.PTT_WEAVE_WEBHOOK_SECRET ?? '';
    if (!verifyWeaveWebhookSign(rawBody, signature, secret)) {
      cpThrow(401, { error: 'invalid_weave_signature' });
    }
    let key = '';
    try {
      const body = JSON.parse(rawBody) as { key?: string };
      key = String(body.key ?? '').trim();
    } catch {
      cpThrow(400, { error: 'invalid_weave_hook_body' });
    }
    if (!key) cpThrow(400, { error: 'key_required' });
    const status = await this.ingestKey(key);
    return { status };
  }

  async submitReview(id: string, scope?: CpWeaveReviewScope) {
    this.assertEnabled();
    const wo = await this.loadWorkOrder(id);
    if (String(wo.status) !== 'linked') {
      this.assertTransition(wo.status as CpWeaveStatus, 'in_review');
    }
    const assets = await this.db.query(
      `SELECT * FROM crm_cp_weave_assets WHERE work_order_id = $1::uuid`,
      [wo.id],
    );
    const reviewable = assets.rows.filter((row) => {
      const lane = String(row.lane ?? '');
      return lane === 'review' || lane === 'final';
    });
    if (!reviewable.length) cpThrow(409, { error: 'weave_review_assets_required' });

    const actor = reviewScope(scope);
    const first = reviewable[0];
    const deps = this.deps();
    let creativeId: string | null = null;
    let versionId: string | null = null;

    if (deps.sopIngest && wo.project_id) {
      const ingested = await deps.sopIngest.ingestFromSop(
        {
          project_id: String(wo.project_id),
          name: String(wo.task_id ?? wo.id),
          output_uri: String(first.storage_uri ?? ''),
        },
        actor,
      );
      versionId = ingested.version_id == null ? null : String(ingested.version_id);
      if (deps.projects && versionId) {
        const submitted = await deps.projects.submitCreative(String(wo.project_id), versionId, actor);
        creativeId = submitted.creative_id == null ? null : String(submitted.creative_id);
      }
    } else if (this.creatives && wo.agency_client_id) {
      const submitted = await this.creatives.submit({
        client_id: String(wo.agency_client_id),
        title: String(wo.task_id ?? wo.id),
        description: `weave:${wo.id}`,
        asset_url: first.storage_uri == null ? undefined : String(first.storage_uri),
        asset_type: guessMime(String(first.storage_uri ?? '')) === 'video/mp4' ? 'video' : 'image',
      });
      creativeId = submitted.creative.id;
    }

    const brief = {
      ...asRecord(wo.brief_json),
      ...(versionId ? { hub_version_id: versionId } : {}),
      ...(creativeId ? { hub_creative_id: creativeId } : {}),
    };
    const updated = await this.db.query(
      `UPDATE crm_cp_weave_work_orders
          SET status = 'in_review', brief_json = $2::jsonb, updated_at = now()
        WHERE id = $1::uuid
        RETURNING *`,
      [wo.id, JSON.stringify(brief)],
    );
    return { ...(updated.rows[0] ?? wo), status: 'in_review', creative_id: creativeId };
  }

  async markApprovedFromHub(versionId: string): Promise<{ updated: number }> {
    const id = String(versionId ?? '').trim();
    if (!id || !UUID_RE.test(id)) return { updated: 0 };
    const updated = await this.db.query(
      `UPDATE crm_cp_weave_work_orders
          SET status = 'approved', updated_at = now()
        WHERE status = 'in_review'
          AND (
            brief_json->>'hub_version_id' = $1
            OR deliverable_id IN (
              SELECT id FROM crm_cp_deliverables
               WHERE video_version_id::text = $1
                  OR creative_id::text = $1
            )
          )
        RETURNING id`,
      [id],
    );
    return { updated: updated.rows.length };
  }

  async deliver(id: string) {
    this.assertEnabled();
    const wo = await this.loadWorkOrder(id);
    const version = await this.loadQcVersion(wo);
    assertNotQcBlocked(version?.qc_status == null ? null : String(version.qc_status));
    if (String(wo.status) !== 'approved') {
      this.assertTransition(wo.status as CpWeaveStatus, 'delivered');
    }
    const assets = await this.db.query(
      `SELECT * FROM crm_cp_weave_assets WHERE work_order_id = $1::uuid`,
      [wo.id],
    );
    const handoff = await this.recordDeliverHandoff(wo, version, assets.rows);
    const brief = { ...asRecord(wo.brief_json), handoff };
    const updated = await this.db.query(
      `UPDATE crm_cp_weave_work_orders
          SET status = 'delivered', brief_json = $2::jsonb, updated_at = now()
        WHERE id = $1::uuid
        RETURNING *`,
      [wo.id, JSON.stringify(brief)],
    );
    if (wo.client_code && wo.campaign_code && wo.task_id) {
      await this.db.query(
        `INSERT INTO crm_cp_weave_assets (work_order_id, storage_uri, source, lane)
         VALUES ($1::uuid, $2, 'prefix_sync', 'approved')
         ON CONFLICT DO NOTHING`,
        [wo.id, `${wo.client_code}/${wo.campaign_code}/${wo.task_id}/approved/`],
      ).catch(() => undefined);
    }
    return { ...(updated.rows[0] ?? wo), status: 'delivered', handoff };
  }

  async addAsset(id: string, input: { storage_uri?: string; source?: string }) {
    this.assertEnabled();
    const wo = await this.loadWorkOrder(id);
    const uri = String(input.storage_uri ?? '').trim();
    if (!uri) cpThrow(400, { error: 'storage_uri_required' });
    const source = input.source === 'upload' || input.source === 'link' ? input.source : 'link';
    const inserted = await this.db.query(
      `INSERT INTO crm_cp_weave_assets (work_order_id, storage_uri, source)
       VALUES ($1::uuid, $2, $3)
       RETURNING *`,
      [wo.id, uri, source],
    );
    return inserted.rows[0];
  }

  private deps(): CpWeaveRuntime {
    return {
      generateBrief: this.runtime?.generateBrief,
      sopIngest: this.runtime?.sopIngest ?? this.sopIngest,
      projects: this.runtime?.projects ?? this.projects,
      campaignWrites: this.runtime?.campaignWrites ?? this.campaignWrites,
      publish: this.runtime?.publish ?? this.publish,
    };
  }

  private async resolveBrief(
    wo: Record<string, unknown>,
    aiEnabled: boolean,
  ): Promise<{ brief: CpWeaveBrief; aiStub: boolean }> {
    const stub = () => ({ brief: normalizeWeaveBrief(this.stubBrief(wo)), aiStub: true });
    if (!aiEnabled) return stub();

    const injected = this.deps().generateBrief;
    if (injected) {
      let project: Record<string, unknown> | null = null;
      try {
        project = await this.loadProject(String(wo.project_id ?? ''));
      } catch {
        project = null;
      }
      const raw = await injected({ work_order: wo, project });
      return { brief: normalizeWeaveBrief(raw), aiStub: false };
    }

    const adapter = selectTextGen({ OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '' });
    if (adapter.providerName === 'stub') return stub();

    let project: Record<string, unknown> | null = null;
    try {
      project = await this.loadProject(String(wo.project_id ?? ''));
    } catch {
      project = null;
    }
    const raw = await adapter.complete({
      system: 'Return Weave brief JSON with creative_brief, prompt, negative_prompt, shot_list, output_format.',
      user: JSON.stringify({ work_order: wo, project }),
    });
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { brief: normalizeWeaveBrief(parsed), aiStub: false };
    } catch {
      return stub();
    }
  }

  private async loadQcVersion(wo: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const brief = asRecord(wo.brief_json);
    const hubVersionId = String(brief.hub_version_id ?? '').trim();
    if (hubVersionId && UUID_RE.test(hubVersionId)) {
      const found = await this.db.query(
        `SELECT id, qc_status, output_uri
           FROM crm_cp_video_versions
          WHERE id = $1::uuid
          LIMIT 1`,
        [hubVersionId],
      );
      if (found.rows[0]) return found.rows[0];
    }
    if (wo.deliverable_id) {
      const viaDeliverable = await this.db.query(
        `SELECT v.id, v.qc_status, v.output_uri
           FROM crm_cp_deliverables d
           JOIN crm_cp_video_versions v ON v.id::text = d.video_version_id::text
          WHERE d.id = $1
          LIMIT 1`,
        [wo.deliverable_id],
      );
      if (viaDeliverable.rows[0]) return viaDeliverable.rows[0];
    }
    if (wo.project_id) {
      const viaProject = await this.db.query(
        `SELECT v.id, v.qc_status, v.output_uri
           FROM crm_cp_video_versions v
           JOIN crm_cp_video_drafts d ON d.id = v.draft_id
          WHERE d.project_id = $1::uuid
          ORDER BY v.created_at DESC NULLS LAST
          LIMIT 1`,
        [wo.project_id],
      );
      if (viaProject.rows[0]) return viaProject.rows[0];
    }
    return null;
  }

  private async recordDeliverHandoff(
    wo: Record<string, unknown>,
    version: Record<string, unknown> | null,
    assets: Record<string, unknown>[],
  ): Promise<CpWeaveHandoff> {
    const finalAsset = assets.find((row) => String(row.lane ?? '') === 'final') ?? assets[0];
    const fileUri = String(
      version?.output_uri
      ?? finalAsset?.storage_uri
      ?? '',
    ).trim();
    const deps = this.deps();
    const utm = {
      utm_source: 'cp-weave',
      utm_medium: 'creative',
      utm_campaign: String(wo.campaign_code ?? ''),
      utm_content: String(wo.task_id ?? ''),
    };

    if (deps.campaignWrites && wo.agency_client_id) {
      try {
        const submitted = await deps.campaignWrites.submit({
          client_id: String(wo.agency_client_id),
          external_campaign_id: String(wo.campaign_code || wo.lifecycle_id || wo.task_id || wo.id),
          change_type: 'update_ad_creative',
          new_value: {
            file: fileUri,
            file_uri: fileUri,
            utm,
            source: 'cp-weave',
            work_order_id: wo.id,
            task_id: wo.task_id,
          },
        });
        return {
          kind: 'campaign_write',
          ok: true,
          request_id: submitted.request?.id == null ? undefined : String(submitted.request.id),
        };
      } catch (error) {
        const skip = adsSkipReason(error);
        if (skip) return { kind: 'skipped', ok: false, skip_reason: skip };
        throw error;
      }
    }

    const versionId = version?.id == null ? '' : String(version.id);
    if (deps.publish && versionId && UUID_RE.test(versionId)) {
      try {
        await deps.publish.deliver(versionId, { scope: 'all', staffId: 0, teamIds: [] });
        return { kind: 'cp_publish', ok: true };
      } catch (error) {
        return { kind: 'skipped', ok: false, skip_reason: adsSkipReason(error) ?? 'cp_publish_failed' };
      }
    }

    return { kind: 'skipped', ok: false, skip_reason: 'ads_module_unavailable' };
  }

  private assertEnabled(): void {
    if (!readAiOpsFlags().weave) cpThrow(404, { error: 'weave_disabled' });
  }

  private assertTransition(from: CpWeaveStatus, to: CpWeaveStatus): void {
    if (!canTransitionWeave(from, to)) {
      cpThrow(409, { error: 'illegal_weave_transition', from, to });
    }
  }

  private async loadWorkOrder(id: string) {
    const woId = requiredUuid(id, 'invalid_work_order_id');
    const result = await this.db.query(
      `SELECT * FROM crm_cp_weave_work_orders WHERE id = $1::uuid LIMIT 1`,
      [woId],
    );
    const row = result.rows[0];
    if (!row) cpThrow(404, { error: 'weave_work_order_not_found' });
    return row;
  }

  private async loadProject(projectId: string) {
    const result = await this.db.query(
      `SELECT id, agency_client_id, lifecycle_id, name
         FROM crm_cp_projects
        WHERE id = $1::uuid
        LIMIT 1`,
      [projectId],
    );
    const row = result.rows[0];
    if (!row) cpThrow(404, { error: 'project_not_found' });
    return row;
  }

  private async loadTemplate(templateKey: string) {
    const result = await this.db.query(
      `SELECT * FROM crm_cp_weave_templates
        WHERE template_key = $1 AND active IS TRUE
        LIMIT 1`,
      [templateKey],
    );
    const row = result.rows[0];
    if (!row) cpThrow(404, { error: 'weave_template_not_found' });
    return row;
  }

  private async loadClientCode(clientId: string) {
    const result = await this.db.query(
      `SELECT code, name FROM clients WHERE id = $1::uuid LIMIT 1`,
      [clientId],
    );
    const row = result.rows[0];
    const code = slugCode(String(row?.code ?? row?.name ?? ''));
    if (!code) cpThrow(400, { error: 'client_code_required' });
    return code;
  }

  private async loadCampaignCode(lifecycleId: string | null) {
    if (!lifecycleId) cpThrow(400, { error: 'lifecycle_required' });
    const result = await this.db.query(
      `SELECT service_slug FROM crm_service_lifecycle WHERE id::text = $1 LIMIT 1`,
      [lifecycleId],
    );
    const slug = slugCode(String(result.rows[0]?.service_slug ?? ''));
    if (!slug) cpThrow(400, { error: 'lifecycle_required' });
    return slug;
  }

  private async nextTaskId(): Promise<string> {
    const now = new Date();
    const ymd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const prefix = nextWeaveTaskId(ymd, 1).slice(0, -3);
    const counted = await this.db.query(
      `SELECT COUNT(*)::int AS n
         FROM crm_cp_weave_work_orders
        WHERE task_id LIKE $1`,
      [`${prefix}%`],
    );
    const n = Number(counted.rows[0]?.n ?? 0);
    return nextWeaveTaskId(ymd, n + 1);
  }

  private resolveStorage(): CpWeaveStoragePort {
    if (this.storage) return this.storage;
    const root = process.env.WEAVE_EXPORT_PREFIX?.trim();
    if (!root) {
      return { list: async () => [], read: async () => Buffer.alloc(0) };
    }
    return createDiskWeaveStorage(root);
  }

  private async ingestParsed(
    wo: Record<string, unknown>,
    parsed: { taskId: string; lane: CpWeaveLane; fileName: string },
    storageKey: string,
    storage: CpWeaveStoragePort,
  ): Promise<{
    status: 'ingested' | 'duplicate' | 'skipped';
    asset?: { id: string; lane: CpWeaveLane; checksum: string };
  }> {
    let bytes: Buffer;
    try {
      bytes = await storage.read(storageKey);
    } catch {
      return { status: 'skipped' };
    }
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const existing = await this.db.query(
      `SELECT a.id, a.checksum
         FROM crm_cp_weave_assets a
         JOIN crm_cp_weave_work_orders w ON w.id = a.work_order_id
        WHERE w.task_id = $1 AND a.checksum = $2
        LIMIT 1`,
      [parsed.taskId, checksum],
    );
    if (existing.rows[0]) return { status: 'duplicate' };

    const sidecar = await readSidecar(storage, storageKey);
    const mime = guessMime(parsed.fileName);
    const probed = await probeWeaveBytes(bytes, mime, storageKey);
    const width = numberOrNull(sidecar.width) ?? probed.width;
    const height = numberOrNull(sidecar.height) ?? probed.height;
    const durationMs = numberOrNull(sidecar.duration_ms) ?? probed.duration_ms;
    const watermark = watermarkForLane(parsed.lane);
    const overlay = await applyWeaveWatermark(bytes, watermark);
    if (storage.write) {
      await storage.write(`${storageKey}.thumb.jpg`, overlay.thumb).catch(() => undefined);
      if (overlay.watermarked) {
        await storage.write(`${storageKey}.proxy.jpg`, overlay.proxy).catch(() => undefined);
      }
    }

    let assetId: string | null = null;
    if (wo.agency_client_id) {
      const asset = await this.db.query(
        `INSERT INTO crm_cp_assets (
           tenant_id, agency_client_id, project_id, owner_staff_id, filename, mime, state, bytes, hash
         ) VALUES ('PTT', $1::uuid, $2::uuid, $3, $4, $5, 'ready', $6, $7)
         RETURNING id`,
        [
          wo.agency_client_id,
          wo.project_id ?? null,
          Number(wo.created_by_staff_id ?? 0) || 0,
          parsed.fileName,
          mime,
          bytes.length,
          checksum,
        ],
      );
      assetId = asset.rows[0]?.id == null ? null : String(asset.rows[0].id);
    }
    const inserted = await this.db.query(
      `INSERT INTO crm_cp_weave_assets (
         work_order_id, asset_id, storage_uri, source, checksum, lane, width, height, duration_ms, watermark
       ) VALUES ($1::uuid, $2, $3, 'prefix_sync', $4, $5, $6, $7, $8, $9)
       RETURNING id, lane, checksum`,
      [
        wo.id,
        assetId,
        storageKey,
        checksum,
        parsed.lane,
        width ?? overlay.width,
        height ?? overlay.height,
        durationMs,
        watermark,
      ],
    );
    const row = inserted.rows[0];
    return {
      status: 'ingested',
      asset: row
        ? { id: String(row.id), lane: parsed.lane, checksum }
        : { id: checksum, lane: parsed.lane, checksum },
    };
  }

  private async markLinked(wo: Record<string, unknown>): Promise<void> {
    const status = String(wo.status ?? 'opened') as CpWeaveStatus;
    if (canTransitionWeave(status, 'assets_exported')) {
      await this.db.query(
        `UPDATE crm_cp_weave_work_orders
            SET status = 'assets_exported', updated_at = now()
          WHERE id = $1::uuid`,
        [wo.id],
      );
      wo.status = 'assets_exported';
    }
    if (canTransitionWeave(String(wo.status) as CpWeaveStatus, 'linked')) {
      await this.db.query(
        `UPDATE crm_cp_weave_work_orders
            SET status = 'linked', updated_at = now()
          WHERE id = $1::uuid`,
        [wo.id],
      );
      wo.status = 'linked';
    }
  }

  private async recordProviderRun(workOrderId: string, projectId: string): Promise<void> {
    try {
      await insertProviderRun(
        { provider: 'weavy', mode: 'manual', workOrderId, status: 'completed' },
        this.db,
      );
    } catch {
      // ledger row is best-effort for Wave A
    }
    if (!projectId || !UUID_RE.test(projectId)) return;
    try {
      await this.db.query(
        `INSERT INTO crm_cp_render_jobs (
           draft_id, project_id, state, stage, progress, provider,
           idempotency_key, correlation_id
         ) VALUES (
           NULL, $1::uuid, 'completed', 'weave_sync', 100, 'weavy', $2, $3
         )
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [projectId, `weavy:${workOrderId}:sync`, `weavy:${workOrderId}`],
      );
    } catch {
      // optional completed job — schema may still require draft_id in older DBs
    }
  }

  private stubBrief(wo: Record<string, unknown>): CpWeaveBrief {
    const key = String(wo.template_key ?? 'feed-1x1');
    const format = FORMAT_BY_TEMPLATE[key] ?? { kind: 'image' as const, width: 1080, height: 1080 };
    return {
      creative_brief: `PTT Weave brief — ${key}`,
      prompt: `PTT Weave stub prompt for ${key}`,
      negative_prompt: '',
      shot_list: ['hero'],
      output_format: format,
    };
  }
}

function isWeaveRuntime(value: unknown): value is CpWeaveRuntime {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.generateBrief === 'function'
    || rec.sopIngest != null
    || rec.projects != null
    || rec.campaignWrites != null
    || rec.publish != null
  );
}

function reviewScope(scope?: CpWeaveReviewScope): CpProjectScope {
  return {
    scope: (scope?.scope ?? 'all') as CpProjectScope['scope'],
    staffId: Number(scope?.staffId ?? 0),
    teamIds: scope?.teamIds ?? [],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readSidecar(
  storage: CpWeaveStoragePort,
  storageKey: string,
): Promise<Record<string, unknown>> {
  const candidates = [
    `${storageKey}.json`,
    storageKey.replace(/\.[^.]+$/, '.json'),
  ];
  for (const key of candidates) {
    if (key === storageKey) continue;
    try {
      const raw = JSON.parse((await storage.read(key)).toString('utf8')) as unknown;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
      }
    } catch {
      // no sidecar or invalid JSON
    }
  }
  return {};
}

async function probeWeaveBytes(
  bytes: Buffer,
  mime: string,
  storageKey: string,
): Promise<{ width: number | null; height: number | null; duration_ms: number | null }> {
  if (mime.startsWith('image/')) {
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(bytes, { failOn: 'none' }).metadata();
      return {
        width: meta.width && meta.width > 0 ? meta.width : null,
        height: meta.height && meta.height > 0 ? meta.height : null,
        duration_ms: null,
      };
    } catch {
      return { width: null, height: null, duration_ms: null };
    }
  }

  const fromPath = probeMediaFile(storageKey);
  if (fromPath) {
    return {
      width: fromPath.width ?? null,
      height: fromPath.height ?? null,
      duration_ms: durationMsFromProbe(fromPath),
    };
  }

  if (!mime.startsWith('video/')) {
    return { width: null, height: null, duration_ms: null };
  }

  let dir = '';
  try {
    dir = await mkdtemp(join(tmpdir(), 'weave-probe-'));
    const file = join(dir, 'asset.bin');
    await writeFile(file, bytes);
    const facts = probeMediaFile(file);
    return {
      width: facts?.width ?? null,
      height: facts?.height ?? null,
      duration_ms: durationMsFromProbe(facts ?? {}),
    };
  } catch {
    return { width: null, height: null, duration_ms: null };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function adsSkipReason(error: unknown): string | null {
  const rec = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const response = rec.response && typeof rec.response === 'object'
    ? rec.response as Record<string, unknown>
    : {};
  const body = response.error && typeof response.error === 'object'
    ? response.error as Record<string, unknown>
    : rec;
  const code = String(body.error ?? rec.error ?? rec.message ?? '').toLowerCase();
  if (
    code.includes('campaign_write')
    || code.includes('unavailable')
    || code.includes('not_ready')
    || rec.status === 503
    || rec.statusCode === 503
  ) {
    return code || 'ads_module_unavailable';
  }
  return null;
}

function isFlagOn(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

function slugCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function requiredUuid(value: unknown, error: string): string {
  const id = String(value ?? '').trim();
  if (!id) cpThrow(400, { error });
  if (!UUID_RE.test(id)) cpThrow(400, { error: 'invalid_id' });
  return id;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
