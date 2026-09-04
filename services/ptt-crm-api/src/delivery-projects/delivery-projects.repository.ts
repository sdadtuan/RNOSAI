import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { normalizeCapabilities } from './delivery-projects.util';
import type {
  DeliveryDeliverableInput,
  DeliveryListFilters,
  DeliveryMilestoneInput,
  DeliveryProjectRow,
} from './delivery-projects.types';

const SELECT_HEADER = `
  SELECT d.id::text,
         d.tenant_id,
         d.code,
         d.name,
         d.capabilities,
         d.b2b_project_id::text,
         d.status,
         d.customer_id,
         d.project_type,
         d.priority,
         d.pm_staff_id,
         d.am_staff_id,
         d.start_date::text,
         d.end_date::text,
         d.description,
         d.health_status,
         d.health_components_json,
         d.row_version,
         d.contract_budget::text,
         d.internal_cost_budget::text,
         d.client_media_budget::text,
         d.forecast_cost::text,
         d.gross_margin_pct::text,
         b.status AS ingest_status,
         b.code AS ingest_code
  FROM crm_delivery_projects d
  LEFT JOIN crm_b2b_projects b ON b.id = d.b2b_project_id
`;

function mapRow(raw: Record<string, unknown>): DeliveryProjectRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    code: raw.code != null ? String(raw.code) : null,
    name: String(raw.name),
    capabilities: normalizeCapabilities(raw.capabilities),
    b2b_project_id: raw.b2b_project_id != null ? String(raw.b2b_project_id) : null,
    status: raw.status as DeliveryProjectRow['status'],
    customer_id: raw.customer_id != null ? Number(raw.customer_id) : null,
    project_type: String(raw.project_type ?? ''),
    priority: String(raw.priority ?? 'normal'),
    pm_staff_id: raw.pm_staff_id != null ? Number(raw.pm_staff_id) : null,
    am_staff_id: raw.am_staff_id != null ? Number(raw.am_staff_id) : null,
    start_date: raw.start_date != null ? String(raw.start_date) : null,
    end_date: raw.end_date != null ? String(raw.end_date) : null,
    description: String(raw.description ?? ''),
    health_status: raw.health_status as DeliveryProjectRow['health_status'],
    health_components_json: (raw.health_components_json as Record<string, unknown>) ?? {},
    row_version: Number(raw.row_version ?? 1),
    ingest_status: raw.ingest_status != null ? (String(raw.ingest_status) as DeliveryProjectRow['ingest_status']) : null,
    ingest_code: raw.ingest_code != null ? String(raw.ingest_code) : null,
    contract_budget: raw.contract_budget != null ? String(raw.contract_budget) : null,
    internal_cost_budget: raw.internal_cost_budget != null ? String(raw.internal_cost_budget) : null,
    client_media_budget: raw.client_media_budget != null ? String(raw.client_media_budget) : null,
    forecast_cost: raw.forecast_cost != null ? String(raw.forecast_cost) : null,
    gross_margin_pct: raw.gross_margin_pct != null ? String(raw.gross_margin_pct) : null,
  };
}

@Injectable()
export class DeliveryProjectsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if ('query' in this.config && !('databaseUrl' in this.config)) {
      return this.config as unknown as Pool;
    }
    if (!this.pool) {
      this.pool = new Pool({ connectionString: (this.config as AppConfigService).databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async tablesReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_delivery_projects' LIMIT 1`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async list(filters: DeliveryListFilters = {}): Promise<DeliveryProjectRow[]> {
    const params: unknown[] = [];
    const clauses: string[] = ['d.deleted_at IS NULL'];

    const cap = filters.capability?.trim() || 'all';
    if (cap === 'lead_ingest') {
      clauses.push(`'lead_ingest' = ANY(d.capabilities)`);
    } else if (cap === 'delivery') {
      clauses.push(`'delivery' = ANY(d.capabilities)`);
    } else if (cap === 'both') {
      clauses.push(`'lead_ingest' = ANY(d.capabilities) AND 'delivery' = ANY(d.capabilities)`);
    }

    if (filters.status?.trim()) {
      params.push(filters.status.trim());
      clauses.push(`d.status = $${params.length}`);
    }

    if (filters.q?.trim()) {
      params.push(`%${filters.q.trim()}%`);
      clauses.push(`(d.name ILIKE $${params.length} OR d.code ILIKE $${params.length} OR b.code ILIKE $${params.length})`);
    }

    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.query(
      `${SELECT_HEADER}${where} ORDER BY d.created_at DESC`,
      params,
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async getById(id: string): Promise<DeliveryProjectRow | null> {
    const result = await this.db.query(`${SELECT_HEADER} WHERE d.id = $1::uuid AND d.deleted_at IS NULL LIMIT 1`, [
      id,
    ]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async insertHeader(row: {
    name: string;
    capabilities: string[];
    code?: string | null;
    b2b_project_id?: string | null;
    status?: string;
    customer_id?: number | null;
    project_type?: string;
    priority?: string;
    pm_staff_id?: number | null;
    am_staff_id?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string;
    health_status?: string;
    health_components_json?: Record<string, unknown>;
    created_by_staff_id?: number | null;
  }): Promise<DeliveryProjectRow> {
    const result = await this.db.query(
      `INSERT INTO crm_delivery_projects (
         name, capabilities, code, b2b_project_id, status,
         customer_id, project_type, priority, pm_staff_id, am_staff_id,
         start_date, end_date, description, health_status, health_components_json, created_by_staff_id
       ) VALUES (
         $1, $2::text[], $3, $4::uuid, COALESCE($5, 'draft'),
         $6, COALESCE($7, ''), COALESCE($8, 'normal'), $9, $10,
         $11::date, $12::date, COALESCE($13, ''), COALESCE($14, 'no_data'), COALESCE($15::jsonb, '{}'::jsonb), $16
       )
       RETURNING id::text`,
      [
        row.name,
        row.capabilities,
        row.code ?? null,
        row.b2b_project_id ?? null,
        row.status ?? null,
        row.customer_id ?? null,
        row.project_type ?? null,
        row.priority ?? null,
        row.pm_staff_id ?? null,
        row.am_staff_id ?? null,
        row.start_date ?? null,
        row.end_date ?? null,
        row.description ?? null,
        row.health_status ?? null,
        row.health_components_json ? JSON.stringify(row.health_components_json) : null,
        row.created_by_staff_id ?? null,
      ],
    );
    const id = String((result.rows[0] as { id: string }).id);
    const inserted = await this.getById(id);
    if (!inserted) throw new Error('insert_failed');
    return inserted;
  }

  async backfillFromB2b(actorStaffId: number): Promise<{ inserted: number }> {
    const missing = await this.db.query(
      `SELECT b.id::text, b.code, b.name, b.status
       FROM crm_b2b_projects b
       WHERE b.id NOT IN (
         SELECT b2b_project_id FROM crm_delivery_projects WHERE b2b_project_id IS NOT NULL
       )`,
    );
    let inserted = 0;
    for (const raw of missing.rows as Array<{ id: string; code: string; name: string; status: string }>) {
      const health =
        raw.status === 'active' ? 'stable' : raw.status === 'paused' ? 'needs_attention' : 'no_data';
      await this.db.query(
        `INSERT INTO crm_delivery_projects (
           name, capabilities, b2b_project_id, status, health_status, created_by_staff_id
         ) VALUES ($1, ARRAY['lead_ingest']::text[], $2::uuid, 'draft', $3, $4)
         ON CONFLICT (b2b_project_id) DO NOTHING`,
        [raw.name, raw.id, health, actorStaffId],
      );
      inserted += 1;
    }
    return { inserted };
  }

  async listPrjCodes(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT code FROM crm_delivery_projects WHERE code IS NOT NULL AND deleted_at IS NULL`,
    );
    return result.rows.map((r) => String((r as { code: string }).code));
  }

  async listMilestones(projectId: string): Promise<Array<{ due_date: string; status: string }>> {
    const result = await this.db.query(
      `SELECT due_date::text, status
       FROM crm_delivery_milestones
       WHERE project_id = $1::uuid
       ORDER BY code ASC`,
      [projectId],
    );
    return result.rows.map((r) => {
      const row = r as { due_date: string | null; status: string };
      return { due_date: row.due_date ?? '', status: row.status };
    });
  }

  async replaceServices(projectId: string, serviceCodes: string[]): Promise<void> {
    await this.db.query(`DELETE FROM crm_delivery_project_services WHERE project_id = $1::uuid`, [projectId]);
    for (let i = 0; i < serviceCodes.length; i += 1) {
      await this.db.query(
        `INSERT INTO crm_delivery_project_services (project_id, service_code, sort_order)
         VALUES ($1::uuid, $2, $3)`,
        [projectId, serviceCodes[i], i],
      );
    }
  }

  async replaceDeliverables(projectId: string, items: DeliveryDeliverableInput[]): Promise<void> {
    await this.db.query(`DELETE FROM crm_delivery_deliverables WHERE project_id = $1::uuid`, [projectId]);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await this.db.query(
        `INSERT INTO crm_delivery_deliverables (
           project_id, service_code, name, quantity, acceptance, owner_staff_id, sort_order
         ) VALUES ($1::uuid, $2, $3, COALESCE($4, ''), COALESCE($5, ''), $6, $7)`,
        [
          projectId,
          item.service_code,
          item.name,
          item.quantity ?? '',
          item.acceptance ?? '',
          item.owner_staff_id ?? null,
          item.sort_order ?? i,
        ],
      );
    }
  }

  async replaceMilestones(
    projectId: string,
    milestones: DeliveryMilestoneInput[],
    deps: Array<{ from: string; to: string }>,
  ): Promise<void> {
    await this.db.query(`DELETE FROM crm_delivery_milestone_deps WHERE project_id = $1::uuid`, [projectId]);
    await this.db.query(`DELETE FROM crm_delivery_milestones WHERE project_id = $1::uuid`, [projectId]);
    for (const m of milestones) {
      await this.db.query(
        `INSERT INTO crm_delivery_milestones (
           project_id, code, name, start_date, due_date, owner_staff_id, status, acceptance, weight
         ) VALUES ($1::uuid, $2, $3, $4::date, $5::date, $6, COALESCE($7, 'planned'), COALESCE($8, ''), $9::numeric)`,
        [
          projectId,
          m.code,
          m.name,
          m.start_date ?? null,
          m.due_date ?? null,
          m.owner_staff_id ?? null,
          m.status ?? null,
          m.acceptance ?? null,
          m.weight ?? null,
        ],
      );
    }
    for (const dep of deps) {
      await this.db.query(
        `INSERT INTO crm_delivery_milestone_deps (project_id, from_code, to_code)
         VALUES ($1::uuid, $2, $3)`,
        [projectId, dep.from, dep.to],
      );
    }
  }

  async upsertWizardDraft(
    projectId: string,
    step: number,
    stateJson: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_delivery_wizard_drafts (project_id, step, state_json, updated_at)
       VALUES ($1::uuid, $2, $3::jsonb, NOW())
       ON CONFLICT (project_id) DO UPDATE SET step = EXCLUDED.step, state_json = EXCLUDED.state_json, updated_at = NOW()`,
      [projectId, step, JSON.stringify(stateJson)],
    );
  }

  async updateHealth(
    projectId: string,
    healthStatus: string,
    components: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_delivery_projects
       SET health_status = $2, health_components_json = $3::jsonb, updated_at = NOW()
       WHERE id = $1::uuid`,
      [projectId, healthStatus, JSON.stringify(components)],
    );
  }

  async patchHeader(id: string, patch: Record<string, unknown>): Promise<DeliveryProjectRow | null> {
    const sets: string[] = ['updated_at = NOW()', 'row_version = row_version + 1'];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      sets.push(clause.replace('?', `$${params.length}`));
    };
    if (patch.name != null) push('name = ?', String(patch.name));
    if (patch.status != null) push('status = ?', String(patch.status));
    if (patch.customer_id !== undefined) push('customer_id = ?', patch.customer_id);
    if (patch.project_type != null) push('project_type = ?', String(patch.project_type));
    if (patch.priority != null) push('priority = ?', String(patch.priority));
    if (patch.pm_staff_id !== undefined) push('pm_staff_id = ?', patch.pm_staff_id);
    if (patch.am_staff_id !== undefined) push('am_staff_id = ?', patch.am_staff_id);
    if (patch.start_date !== undefined) push('start_date = ?::date', patch.start_date);
    if (patch.end_date !== undefined) push('end_date = ?::date', patch.end_date);
    if (patch.description != null) push('description = ?', String(patch.description));
    if (sets.length <= 2) return this.getById(id);
    params.push(id);
    await this.db.query(
      `UPDATE crm_delivery_projects SET ${sets.join(', ')} WHERE id = $${params.length}::uuid AND deleted_at IS NULL`,
      params,
    );
    return this.getById(id);
  }
}
