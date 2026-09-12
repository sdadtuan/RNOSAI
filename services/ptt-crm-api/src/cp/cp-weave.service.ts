import { HttpException, Inject, Injectable } from '@nestjs/common';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { normalizeWeaveBrief } from './cp-weave-brief.util';
import { buildWeaveOpenUrl } from './cp-weave-open.util';
import { nextWeaveTaskId } from './cp-weave-path.util';
import { CP_WEAVE_QUERY, CpWeaveQueryPort } from './cp-weave.repository';
import {
  canTransitionWeave,
  type CpWeaveBrief,
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
  constructor(@Inject(CP_WEAVE_QUERY) private readonly db: CpWeaveQueryPort) {}

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
