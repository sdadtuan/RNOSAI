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
export type OpsPlanRow = {
  id: number;
  name: string;
  status: string;
  period_label: string;
  lifecycle_id: number | null;
  success_metrics_json: unknown;
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

  async getPlan(id: number): Promise<OpsPlanRow | null> {
    const r = await this.db.query(
      `SELECT id, name, status, period_label, lifecycle_id, success_metrics_json
       FROM crm_marketing_plans WHERE id = $1 LIMIT 1`,
      [id],
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
