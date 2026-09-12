import { createHash } from 'crypto';
import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { insertProviderRun } from './cp-provider-runs.repository';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { normalizeWeaveBrief } from './cp-weave-brief.util';
import {
  guessMime,
  shouldIngestLane,
  verifyWeaveWebhookSign,
  watermarkForLane,
  type CpWeaveIngestResult,
  type CpWeaveStoragePort,
} from './cp-weave-ingest.util';
import { createDiskWeaveStorage } from './cp-weave-ingest.util';
import { buildWeaveOpenUrl } from './cp-weave-open.util';
import { nextWeaveTaskId, parseWeaveExportKey } from './cp-weave-path.util';
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

export type CpWeaveCreateInput = {
  project_id?: string;
  template_key?: string;
  deliverable_id?: string | null;
};

@Injectable()
export class CpWeaveService {
  constructor(
    @Inject(CP_WEAVE_QUERY) private readonly db: CpWeaveQueryPort,
    @Optional() private readonly storage?: CpWeaveStoragePort,
  ) {}

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
    const brief = normalizeWeaveBrief(this.stubBrief(wo));
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
      ai_stub: !aiEnabled,
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
    for (const key of keys) {
      const parsed = parseWeaveExportKey(key);
      if (!parsed) {
        result.skipped += 1;
        result.warnings.push(`skip ${key}`);
        continue;
      }
      if (!shouldIngestLane(parsed.lane, opts?.include_drafts === true)) {
        result.skipped += 1;
        continue;
      }
      const outcome = await this.ingestParsed(wo, parsed, key, storage);
      if (outcome.status === 'ingested') {
        result.ingested += 1;
        if (outcome.asset) result.assets.push(outcome.asset);
      } else {
        result.skipped += 1;
        if (outcome.status === 'duplicate') result.warnings.push(`duplicate ${key}`);
      }
    }
    if (result.ingested > 0) {
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
    if (!parsed || !shouldIngestLane(parsed.lane, false)) return 'skipped';
    const found = await this.db.query(
      `SELECT * FROM crm_cp_weave_work_orders WHERE task_id = $1 LIMIT 1`,
      [parsed.taskId],
    );
    const wo = found.rows[0];
    if (!wo) return 'skipped';
    const outcome = await this.ingestParsed(wo, parsed, storageKey, storage);
    if (outcome.status === 'ingested') {
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
    if (!lifecycleId) return 'campaign';
    const result = await this.db.query(
      `SELECT service_slug FROM crm_service_lifecycle WHERE id::text = $1 LIMIT 1`,
      [lifecycleId],
    );
    return slugCode(String(result.rows[0]?.service_slug ?? 'campaign')) || 'campaign';
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

    const watermark = watermarkForLane(parsed.lane);
    const mime = guessMime(parsed.fileName);
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
       ) VALUES ($1::uuid, $2, $3, 'prefix_sync', $4, $5, NULL, NULL, NULL, $6)
       RETURNING id, lane, checksum`,
      [wo.id, assetId, storageKey, checksum, parsed.lane, watermark],
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
