import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type OpsClientRow = { id: string; name: string; status: string };
export type OpsLifecycleRow = {
  id: number;
  stage: string;
  status: string;
  marketing_plan_id: number | null;
  agency_client_id: string | null;
};

export type OpsLifecycleTransitionRow = OpsLifecycleRow & {
  notes: string;
};
export type OpsPlanRow = {
  id: number;
  name: string;
  status: string;
  period_label: string;
  lifecycle_id: number | null;
  success_metrics_json: unknown;
};

/** Extended plan fields for P3 draft write / clone. */
export type OpsPlanWriteRow = OpsPlanRow & {
  objectives: string;
  notes: string;
  strategy_framework_json: Record<string, unknown>;
};

export type OpsPlanDraftInsert = {
  name: string;
  period_label?: string;
  objectives?: string;
  notes?: string;
  lifecycle_id?: number | null;
  strategy_framework_json?: Record<string, unknown>;
};

export type OpsPlanDraftPatch = {
  name?: string;
  period_label?: string;
  objectives?: string;
  notes?: string;
  strategy_framework_json?: Record<string, unknown>;
};

export type OpsAiDraftTaskInsert = {
  lifecycle_id: number;
  stage: string;
  title: string;
  description: string;
  form_data: Record<string, unknown>;
};

export type OpsAiDraftTaskRow = {
  id: number;
  lifecycle_id: number;
  title: string;
  stage: string;
};

export type OpsAiDraftTaskWriteRow = OpsAiDraftTaskRow & {
  description: string;
  form_data: Record<string, unknown>;
};

export type OpsAiDraftTaskPatch = {
  title?: string;
  description?: string;
  form_data?: Record<string, unknown>;
};
export type OpsMilestoneRow = {
  id: number;
  title: string;
  status: string;
  due_date: string;
};
export type OpsTaskRow = { id: number; title: string; stage: string };
export type OpsProjectRow = {
  id: string;
  name: string;
  status: string;
  health_status: string;
  lifecycle_id: number | null;
};
export type OpsCampaignRow = {
  id: number;
  name: string;
  code: string;
  status: string;
  channel: string;
};

@Injectable()
export class OpsCrmContextRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async getClient(clientId: string): Promise<OpsClientRow | null> {
    const r = await this.db.query(
      `SELECT id::text, name, status FROM clients WHERE id = $1::uuid LIMIT 1`,
      [clientId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      status: String(row.status ?? ''),
    };
  }

  async getLifecycle(id: number): Promise<OpsLifecycleRow | null> {
    const r = await this.db.query(
      `SELECT sl.id, sl.stage, sl.status, sl.marketing_plan_id,
              TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id
       FROM crm_service_lifecycle sl
       LEFT JOIN crm_contracts ct ON ct.id = sl.contract_id
       WHERE sl.id = $1
       LIMIT 1`,
      [id],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      stage: String(row.stage ?? ''),
      status: String(row.status ?? ''),
      marketing_plan_id:
        row.marketing_plan_id == null ? null : Number(row.marketing_plan_id),
      agency_client_id: String(row.agency_client_id ?? '').trim() || null,
    };
  }

  async getLifecycleForTransition(id: number): Promise<OpsLifecycleTransitionRow | null> {
    const r = await this.db.query(
      `SELECT sl.id, sl.stage, sl.status, sl.marketing_plan_id,
              COALESCE(sl.notes, '') AS notes,
              TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id
       FROM crm_service_lifecycle sl
       LEFT JOIN crm_contracts ct ON ct.id = sl.contract_id
       WHERE sl.id = $1
       LIMIT 1`,
      [id],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      stage: String(row.stage ?? ''),
      status: String(row.status ?? ''),
      marketing_plan_id:
        row.marketing_plan_id == null ? null : Number(row.marketing_plan_id),
      agency_client_id: String(row.agency_client_id ?? '').trim() || null,
      notes: String(row.notes ?? ''),
    };
  }

  async countTasksByStage(
    lifecycleId: number,
    stage: string,
  ): Promise<{ total: number; open: number; done: number }> {
    const stages =
      stage === 'proposal' || stage === 'quote'
        ? ['proposal', 'quote']
        : [stage];
    const r = await this.db.query(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN COALESCE(is_done, false) THEN 1 ELSE 0 END)::int AS done
       FROM crm_svc_tasks
       WHERE lifecycle_id = $1 AND stage = ANY($2::text[])`,
      [lifecycleId, stages],
    );
    const total = Number(r.rows[0]?.total ?? 0);
    const done = Number(r.rows[0]?.done ?? 0);
    return { total, done, open: Math.max(0, total - done) };
  }

  async applyLifecycleStageTransition(input: {
    lifecycleId: number;
    fromStage: string;
    toStage: string;
    notes: string;
    actorType: string;
    actorLabel: string;
  }): Promise<void> {
    const notes = String(input.notes ?? '').slice(0, 4000);
    await this.db.query(
      `UPDATE crm_service_lifecycle
       SET stage = $2,
           stage_entered_at = NOW(),
           updated_at = NOW(),
           notes = CASE
             WHEN COALESCE(notes, '') = '' THEN $3
             ELSE notes || E'\\n' || $3
           END
       WHERE id = $1`,
      [input.lifecycleId, input.toStage, notes],
    );
    await this.db.query(
      `INSERT INTO crm_service_lifecycle_events
         (lifecycle_id, from_stage, to_stage, actor_type, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        input.lifecycleId,
        input.fromStage,
        input.toStage,
        input.actorType.slice(0, 64),
        `${input.actorLabel}: ${notes}`.slice(0, 2000),
      ],
    );
  }

  async findPrimaryLifecycleByClient(clientId: string): Promise<OpsLifecycleRow | null> {
    const r = await this.db.query(
      `SELECT sl.id, sl.stage, sl.status, sl.marketing_plan_id,
              TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id
       FROM crm_service_lifecycle sl
       INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
       WHERE TRIM(COALESCE(ct.agency_client_id, '')) = $1
         AND sl.status IN ('active', 'draft')
       ORDER BY CASE WHEN sl.status = 'active' THEN 0 ELSE 1 END,
                sl.updated_at DESC
       LIMIT 1`,
      [clientId.trim()],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      stage: String(row.stage ?? ''),
      status: String(row.status ?? ''),
      marketing_plan_id:
        row.marketing_plan_id == null ? null : Number(row.marketing_plan_id),
      agency_client_id: String(row.agency_client_id ?? '').trim() || null,
    };
  }

  private mapPlanRow(row: Record<string, unknown>): OpsPlanRow {
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      status: String(row.status ?? ''),
      period_label: String(row.period_label ?? ''),
      lifecycle_id: row.lifecycle_id == null ? null : Number(row.lifecycle_id),
      success_metrics_json: row.success_metrics_json,
    };
  }

  private mapPlanWriteRow(row: Record<string, unknown>): OpsPlanWriteRow {
    const sf = row.strategy_framework_json;
    let strategy: Record<string, unknown> = {};
    if (sf && typeof sf === 'object' && !Array.isArray(sf)) {
      strategy = sf as Record<string, unknown>;
    } else if (typeof sf === 'string' && sf.trim()) {
      try {
        const parsed = JSON.parse(sf) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          strategy = parsed as Record<string, unknown>;
        }
      } catch {
        strategy = {};
      }
    }
    return {
      ...this.mapPlanRow(row),
      objectives: String(row.objectives ?? ''),
      notes: String(row.notes ?? ''),
      strategy_framework_json: strategy,
    };
  }

  async getPlan(id: number): Promise<OpsPlanRow | null> {
    const r = await this.db.query(
      `SELECT id, name, status, period_label, lifecycle_id, success_metrics_json
       FROM crm_marketing_plans WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = r.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPlanRow(row) : null;
  }

  async getPlanForWrite(id: number): Promise<OpsPlanWriteRow | null> {
    const r = await this.db.query(
      `SELECT id, name, status, period_label, lifecycle_id, success_metrics_json,
              COALESCE(objectives, '') AS objectives,
              COALESCE(notes, '') AS notes,
              COALESCE(strategy_framework_json, '{}'::jsonb) AS strategy_framework_json
       FROM crm_marketing_plans WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = r.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPlanWriteRow(row) : null;
  }

  async insertPlanDraft(input: OpsPlanDraftInsert): Promise<OpsPlanRow> {
    const code = `AI-DRAFT-${Date.now()}`;
    const sf = JSON.stringify(input.strategy_framework_json ?? {});
    const r = await this.db.query(
      `INSERT INTO crm_marketing_plans (
         code, name, status, plan_kind, lifecycle_id, period_label, objectives, notes,
         strategy_framework_json, target_market_prof_json, target_market_steps4_json,
         created_at, updated_at
       ) VALUES (
         $1, $2, 'draft', 'standalone', $3, $4, $5, $6,
         $7::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW()
       ) RETURNING id`,
      [
        code,
        String(input.name ?? '').slice(0, 400),
        input.lifecycle_id ?? null,
        String(input.period_label ?? '').slice(0, 120),
        String(input.objectives ?? '').slice(0, 32000),
        String(input.notes ?? '').slice(0, 32000),
        sf,
      ],
    );
    const plan = await this.getPlan(Number(r.rows[0]?.id));
    if (!plan) throw new Error('insertPlanDraft failed');
    return plan;
  }

  async patchPlanDraft(planId: number, fields: OpsPlanDraftPatch): Promise<OpsPlanRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [planId];
    const push = (sql: string, value: unknown) => {
      params.push(value);
      sets.push(`${sql} = $${params.length}`);
    };
    if (fields.name != null) push('name', String(fields.name).slice(0, 400));
    if (fields.period_label != null) {
      push('period_label', String(fields.period_label).slice(0, 120));
    }
    if (fields.objectives != null) {
      push('objectives', String(fields.objectives).slice(0, 32000));
    }
    if (fields.notes != null) push('notes', String(fields.notes).slice(0, 32000));
    if (fields.strategy_framework_json != null) {
      params.push(JSON.stringify(fields.strategy_framework_json));
      sets.push(
        `strategy_framework_json = COALESCE(strategy_framework_json, '{}'::jsonb) || $${params.length}::jsonb`,
      );
    }
    if (sets.length === 0) return this.getPlan(planId);
    sets.push('updated_at = NOW()');
    await this.db.query(
      `UPDATE crm_marketing_plans SET ${sets.join(', ')} WHERE id = $1`,
      params,
    );
    return this.getPlan(planId);
  }

  async clonePlanToDraft(
    sourceId: number,
    overlay: OpsPlanDraftPatch = {},
  ): Promise<OpsPlanRow> {
    const source = await this.getPlanForWrite(sourceId);
    if (!source) throw new Error(`clonePlanToDraft: plan ${sourceId} not found`);
    const mergedSf = {
      ...source.strategy_framework_json,
      ...(overlay.strategy_framework_json ?? {}),
    };
    return this.insertPlanDraft({
      name: overlay.name ?? `${source.name} (draft)`,
      period_label: overlay.period_label ?? source.period_label,
      objectives: overlay.objectives ?? source.objectives,
      notes: overlay.notes ?? source.notes,
      lifecycle_id: source.lifecycle_id,
      strategy_framework_json: mergedSf,
    });
  }

  async insertAiDraftTask(input: OpsAiDraftTaskInsert): Promise<OpsAiDraftTaskRow> {
    const r = await this.db.query(
      `INSERT INTO crm_svc_tasks (
         lifecycle_id, stage, step_index, title, description,
         form_fields, form_data, ai_prompt_key, ai_output, is_done, notes, is_custom,
         created_at, updated_at
       ) VALUES (
         $1, $2, 999, $3, $4,
         '[]'::jsonb, $5::jsonb, '', '', FALSE, '', TRUE,
         NOW(), NOW()
       ) RETURNING id`,
      [
        input.lifecycle_id,
        input.stage,
        String(input.title ?? '').slice(0, 400),
        String(input.description ?? '').slice(0, 4000),
        JSON.stringify(input.form_data ?? {}),
      ],
    );
    return {
      id: Number(r.rows[0]?.id),
      lifecycle_id: input.lifecycle_id,
      title: String(input.title ?? '').slice(0, 400),
      stage: input.stage,
    };
  }

  async getAiDraftTaskForWrite(taskId: number): Promise<OpsAiDraftTaskWriteRow | null> {
    const r = await this.db.query(
      `SELECT id, lifecycle_id, title, stage, description, form_data
       FROM crm_svc_tasks WHERE id = $1 LIMIT 1`,
      [taskId],
    );
    const row = r.rows[0];
    if (!row) return null;
    let formData: Record<string, unknown> = {};
    const raw = row.form_data;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      formData = raw as Record<string, unknown>;
    } else if (typeof raw === 'string') {
      try {
        formData = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        formData = {};
      }
    }
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      title: String(row.title ?? ''),
      stage: String(row.stage ?? ''),
      description: String(row.description ?? ''),
      form_data: formData,
    };
  }

  async updateAiDraftTask(
    taskId: number,
    patch: OpsAiDraftTaskPatch,
  ): Promise<OpsAiDraftTaskWriteRow | null> {
    const existing = await this.getAiDraftTaskForWrite(taskId);
    if (!existing) return null;
    const title =
      patch.title != null ? String(patch.title).slice(0, 400) : existing.title;
    const description =
      patch.description != null
        ? String(patch.description).slice(0, 4000)
        : existing.description;
    const formData = patch.form_data ?? existing.form_data;
    await this.db.query(
      `UPDATE crm_svc_tasks
       SET title = $2, description = $3, form_data = $4::jsonb, updated_at = NOW()
       WHERE id = $1`,
      [taskId, title, description, JSON.stringify(formData)],
    );
    return this.getAiDraftTaskForWrite(taskId);
  }

  async findPlanByLifecycle(lifecycleId: number): Promise<OpsPlanRow | null> {
    const r = await this.db.query(
      `SELECT id, name, status, period_label, lifecycle_id, success_metrics_json
       FROM crm_marketing_plans
       WHERE lifecycle_id = $1 OR id = (
         SELECT marketing_plan_id FROM crm_service_lifecycle WHERE id = $1
       )
       ORDER BY updated_at DESC
       LIMIT 1`,
      [lifecycleId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      status: String(row.status ?? ''),
      period_label: String(row.period_label ?? ''),
      lifecycle_id: row.lifecycle_id == null ? null : Number(row.lifecycle_id),
      success_metrics_json: row.success_metrics_json,
    };
  }

  async listMilestones(planId: number): Promise<OpsMilestoneRow[]> {
    const r = await this.db.query(
      `SELECT id, title, status, COALESCE(due_date, '') AS due_date
       FROM crm_marketing_plan_milestones
       WHERE plan_id = $1
       ORDER BY position ASC, id ASC`,
      [planId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ''),
      status: String(row.status ?? ''),
      due_date: String(row.due_date ?? ''),
    }));
  }

  async listOpenTasks(lifecycleId: number): Promise<OpsTaskRow[]> {
    const r = await this.db.query(
      `SELECT id, title, stage
       FROM crm_svc_tasks
       WHERE lifecycle_id = $1
         AND COALESCE(is_done, false) = false
       ORDER BY stage, step_index ASC, id ASC
       LIMIT 50`,
      [lifecycleId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ''),
      stage: String(row.stage ?? ''),
    }));
  }

  async getProject(id: string): Promise<OpsProjectRow | null> {
    const r = await this.db.query(
      `SELECT id::text, name, status, health_status, lifecycle_id
       FROM crm_delivery_projects
       WHERE id = $1::uuid AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      status: String(row.status ?? ''),
      health_status: String(row.health_status ?? ''),
      lifecycle_id: row.lifecycle_id == null ? null : Number(row.lifecycle_id),
    };
  }

  async findProjectByLifecycle(lifecycleId: number): Promise<OpsProjectRow | null> {
    const r = await this.db.query(
      `SELECT id::text, name, status, health_status, lifecycle_id
       FROM crm_delivery_projects
       WHERE lifecycle_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [lifecycleId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      status: String(row.status ?? ''),
      health_status: String(row.health_status ?? ''),
      lifecycle_id: row.lifecycle_id == null ? null : Number(row.lifecycle_id),
    };
  }

  async listPlanCampaigns(planId: number): Promise<OpsCampaignRow[]> {
    const r = await this.db.query(
      `SELECT c.id,
              COALESCE(c.name, c.code, '') AS name,
              COALESCE(c.code, '') AS code,
              COALESCE(c.status, '') AS status,
              COALESCE(c.channel, '') AS channel
       FROM crm_marketing_plan_campaigns mpc
       INNER JOIN crm_campaigns c ON c.id = mpc.campaign_id
       WHERE mpc.plan_id = $1
       ORDER BY c.id ASC
       LIMIT 50`,
      [planId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      code: String(row.code ?? ''),
      status: String(row.status ?? ''),
      channel: String(row.channel ?? ''),
    }));
  }
}
