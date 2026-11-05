import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  computeGrossMarginPct,
  internalCostFromItems,
  overlapAllocationPct,
  parseDecimal,
} from './delivery-budget.util';

export type BudgetItemRow = {
  id: string;
  project_id: string;
  name: string;
  service_code: string | null;
  kind: string;
  media_borne: string | null;
  cost_center: string | null;
  owner_staff_id: number | null;
  approved_budget: string;
  forecast: string;
  actual: string;
  allocation_method: string;
  description: string | null;
  row_version: number;
};

export type ResourceRow = {
  id: string;
  project_id: string;
  staff_id: number;
  role_name: string | null;
  team_name: string | null;
  allocation_pct: string;
  start_date: string;
  end_date: string;
  estimated_cost: string | null;
  overload_reason: string | null;
  row_version: number;
};

export type ProjectBudgetHeader = {
  contract_budget: string | null;
  internal_cost_budget: string | null;
  client_media_budget: string | null;
  contingency_amount: string | null;
  forecast_cost: string | null;
  gross_margin_pct: string | null;
  finance_policy_json: Record<string, unknown>;
  status: string;
};

export type BudgetItemInput = {
  name: string;
  service_code?: string | null;
  kind: string;
  media_borne?: string | null;
  cost_center?: string | null;
  owner_staff_id?: number | null;
  approved_budget: string;
  forecast: string;
  allocation_method?: string;
  description?: string | null;
};

export type ResourceInput = {
  staff_id: number;
  role_name?: string | null;
  team_name?: string | null;
  allocation_pct: string;
  start_date: string;
  end_date: string;
  estimated_cost?: string | null;
  overload_reason?: string | null;
};

function numStr(v: unknown): string {
  if (v == null) return '0.00';
  return parseDecimal(String(v)) ?? '0.00';
}

function mapItem(raw: Record<string, unknown>): BudgetItemRow {
  return {
    id: String(raw.id),
    project_id: String(raw.project_id),
    name: String(raw.name),
    service_code: raw.service_code != null ? String(raw.service_code) : null,
    kind: String(raw.kind),
    media_borne: raw.media_borne != null ? String(raw.media_borne) : null,
    cost_center: raw.cost_center != null ? String(raw.cost_center) : null,
    owner_staff_id: raw.owner_staff_id != null ? Number(raw.owner_staff_id) : null,
    approved_budget: numStr(raw.approved_budget),
    forecast: numStr(raw.forecast),
    actual: numStr(raw.actual),
    allocation_method: String(raw.allocation_method ?? 'even'),
    description: raw.description != null ? String(raw.description) : null,
    row_version: Number(raw.row_version ?? 1),
  };
}

function mapResource(raw: Record<string, unknown>): ResourceRow {
  return {
    id: String(raw.id),
    project_id: String(raw.project_id),
    staff_id: Number(raw.staff_id),
    role_name: raw.role_name != null ? String(raw.role_name) : null,
    team_name: raw.team_name != null ? String(raw.team_name) : null,
    allocation_pct: numStr(raw.allocation_pct),
    start_date: String(raw.start_date),
    end_date: String(raw.end_date),
    estimated_cost: raw.estimated_cost != null ? numStr(raw.estimated_cost) : null,
    overload_reason: raw.overload_reason != null ? String(raw.overload_reason) : null,
    row_version: Number(raw.row_version ?? 1),
  };
}

@Injectable()
export class DeliveryBudgetRepository implements OnModuleDestroy {
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

  async getProjectBudgetHeader(projectId: string): Promise<ProjectBudgetHeader | null> {
    const result = await this.db.query(
      `SELECT contract_budget::text,
              internal_cost_budget::text,
              client_media_budget::text,
              contingency_amount::text,
              forecast_cost::text,
              gross_margin_pct::text,
              finance_policy_json,
              status
       FROM crm_delivery_projects
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [projectId],
    );
    if (!result.rows[0]) return null;
    const raw = result.rows[0] as Record<string, unknown>;
    return {
      contract_budget: raw.contract_budget != null ? numStr(raw.contract_budget) : null,
      internal_cost_budget: raw.internal_cost_budget != null ? numStr(raw.internal_cost_budget) : null,
      client_media_budget: raw.client_media_budget != null ? numStr(raw.client_media_budget) : null,
      contingency_amount: raw.contingency_amount != null ? numStr(raw.contingency_amount) : null,
      forecast_cost: raw.forecast_cost != null ? numStr(raw.forecast_cost) : null,
      gross_margin_pct: raw.gross_margin_pct != null ? String(raw.gross_margin_pct) : null,
      finance_policy_json: (raw.finance_policy_json as Record<string, unknown>) ?? {},
      status: String(raw.status),
    };
  }

  async listItems(projectId: string): Promise<BudgetItemRow[]> {
    const result = await this.db.query(
      `SELECT id::text, project_id::text, name, service_code, kind, media_borne, cost_center,
              owner_staff_id, approved_budget::text, forecast::text, actual::text,
              allocation_method, description, row_version
       FROM crm_delivery_budget_items
       WHERE project_id = $1::uuid AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [projectId],
    );
    return result.rows.map((r) => mapItem(r as Record<string, unknown>));
  }

  async insertItem(projectId: string, input: BudgetItemInput): Promise<BudgetItemRow> {
    const result = await this.db.query(
      `INSERT INTO crm_delivery_budget_items
         (project_id, name, service_code, kind, media_borne, cost_center, owner_staff_id,
          approved_budget, forecast, actual, allocation_method, description)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, 0, $10, $11)
       RETURNING id::text, project_id::text, name, service_code, kind, media_borne, cost_center,
                 owner_staff_id, approved_budget::text, forecast::text, actual::text,
                 allocation_method, description, row_version`,
      [
        projectId,
        input.name,
        input.service_code ?? null,
        input.kind,
        input.media_borne ?? null,
        input.cost_center ?? null,
        input.owner_staff_id ?? null,
        input.approved_budget,
        input.forecast,
        input.allocation_method ?? 'even',
        input.description ?? null,
      ],
    );
    return mapItem(result.rows[0] as Record<string, unknown>);
  }

  async previewImpact(
    projectId: string,
    draftItem: BudgetItemInput,
  ): Promise<{
    internal_before: string;
    internal_after: string;
    contract: string | null;
    margin_before: string | null;
    margin_after: string | null;
    allocated_pct: string;
    policy_critical: boolean;
    forecast_over_budget: boolean;
  }> {
    const header = await this.getProjectBudgetHeader(projectId);
    const items = await this.listItems(projectId);
    const contract = header?.contract_budget ?? null;
    const contingency = header?.contingency_amount ?? '0.00';

    const existingItems = items.map((i) => ({
      amount: i.forecast,
      kind: i.kind,
      media_borne: i.media_borne as 'agency_borne' | 'client_borne' | undefined,
    }));
    const internalBefore = internalCostFromItems(existingItems);

    const draftItems = [
      ...existingItems,
      {
        amount: draftItem.forecast,
        kind: draftItem.kind,
        media_borne: draftItem.media_borne as 'agency_borne' | 'client_borne' | undefined,
      },
    ];
    const internalAfter = internalCostFromItems(draftItems);

    const marginBefore =
      contract != null
        ? computeGrossMarginPct({ contract, internalForecast: internalBefore, contingency })
        : null;
    const marginAfter =
      contract != null
        ? computeGrossMarginPct({ contract, internalForecast: internalAfter, contingency })
        : null;

    const policy = header?.finance_policy_json ?? {};
    const minMargin = Number(policy.min_gross_margin_pct ?? 30);
    const marginNum = marginAfter != null ? Number(marginAfter) : null;
    const policyCritical = marginNum != null && marginNum < minMargin;

    const approvedBudget = header?.internal_cost_budget ?? '0.00';
    const forecastOver = parseDecimal(internalAfter)! > parseDecimal(approvedBudget)!;

    const contractCents = contract ? Number(parseDecimal(contract)) : 0;
    const allocatedPct =
      contractCents > 0
        ? String(Math.round((Number(parseDecimal(internalAfter)) / contractCents) * 1000) / 10)
        : '0';

    return {
      internal_before: internalBefore,
      internal_after: internalAfter,
      contract,
      margin_before: marginBefore,
      margin_after: marginAfter,
      allocated_pct: allocatedPct,
      policy_critical: policyCritical,
      forecast_over_budget: forecastOver,
    };
  }

  async listResources(projectId: string): Promise<ResourceRow[]> {
    const result = await this.db.query(
      `SELECT id::text, project_id::text, staff_id, role_name, team_name,
              allocation_pct::text, start_date::text, end_date::text,
              estimated_cost::text, overload_reason, row_version
       FROM crm_delivery_resources
       WHERE project_id = $1::uuid AND deleted_at IS NULL
       ORDER BY start_date ASC`,
      [projectId],
    );
    return result.rows.map((r) => mapResource(r as Record<string, unknown>));
  }

  async insertResource(projectId: string, input: ResourceInput): Promise<ResourceRow> {
    const result = await this.db.query(
      `INSERT INTO crm_delivery_resources
         (project_id, staff_id, role_name, team_name, allocation_pct, start_date, end_date,
          estimated_cost, overload_reason)
       VALUES ($1::uuid, $2, $3, $4, $5::numeric, $6::date, $7::date, $8::numeric, $9)
       RETURNING id::text, project_id::text, staff_id, role_name, team_name,
                 allocation_pct::text, start_date::text, end_date::text,
                 estimated_cost::text, overload_reason, row_version`,
      [
        projectId,
        input.staff_id,
        input.role_name ?? null,
        input.team_name ?? null,
        input.allocation_pct,
        input.start_date,
        input.end_date,
        input.estimated_cost ?? null,
        input.overload_reason ?? null,
      ],
    );
    return mapResource(result.rows[0] as Record<string, unknown>);
  }

  async sumStaffOverlap(
    staffId: number,
    range: { start: string; end: string },
    excludeProjectId?: string,
  ): Promise<number> {
    const params: unknown[] = [staffId, range.start, range.end];
    let exclude = '';
    if (excludeProjectId) {
      params.push(excludeProjectId);
      exclude = ` AND r.project_id <> $4::uuid`;
    }
    const result = await this.db.query(
      `SELECT r.allocation_pct::float AS pct,
              r.start_date::text AS start,
              r.end_date::text AS end,
              p.status AS project_status
       FROM crm_delivery_resources r
       JOIN crm_delivery_projects p ON p.id = r.project_id
       WHERE r.staff_id = $1
         AND r.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND r.start_date <= $3::date
         AND r.end_date >= $2::date
         ${exclude}`,
      params,
    );
    const assignments = result.rows.map((row) => ({
      staff_id: staffId,
      pct: Number((row as { pct: number }).pct),
      start: String((row as { start: string }).start),
      end: String((row as { end: string }).end),
      project_status: String((row as { project_status: string }).project_status),
    }));
    return overlapAllocationPct(assignments, staffId, range);
  }

  async recalcProjectBudget(projectId: string): Promise<void> {
    const items = await this.listItems(projectId);
    let internalCents = 0;
    let clientMediaCents = 0;
    let forecastCents = 0;
    for (const item of items) {
      const fc = Number(parseDecimal(item.forecast) ?? '0');
      forecastCents += fc;
      if (item.kind === 'media' && item.media_borne === 'client_borne') {
        clientMediaCents += fc;
      } else {
        internalCents += fc;
      }
    }
    const header = await this.getProjectBudgetHeader(projectId);
    const contract = header?.contract_budget;
    const contingency = header?.contingency_amount ?? '0.00';
    const internalStr = parseDecimal(String(internalCents)) ?? '0.00';
    const margin =
      contract != null
        ? computeGrossMarginPct({ contract, internalForecast: internalStr, contingency })
        : null;

    await this.db.query(
      `UPDATE crm_delivery_projects
       SET internal_cost_budget = $2::numeric,
           client_media_budget = $3::numeric,
           forecast_cost = $4::numeric,
           gross_margin_pct = $5::numeric,
           updated_at = now()
       WHERE id = $1::uuid`,
      [projectId, internalStr, parseDecimal(String(clientMediaCents)), parseDecimal(String(forecastCents)), margin],
    );
  }

  async updateProjectBudgetHeader(
    projectId: string,
    patch: {
      contract_budget?: string | null;
      contingency_amount?: string | null;
      finance_policy_json?: Record<string, unknown>;
    },
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [projectId];
    if (patch.contract_budget !== undefined) {
      params.push(patch.contract_budget);
      sets.push(`contract_budget = $${params.length}::numeric`);
    }
    if (patch.contingency_amount !== undefined) {
      params.push(patch.contingency_amount);
      sets.push(`contingency_amount = $${params.length}::numeric`);
    }
    if (patch.finance_policy_json !== undefined) {
      params.push(JSON.stringify(patch.finance_policy_json));
      sets.push(`finance_policy_json = $${params.length}::jsonb`);
    }
    if (sets.length === 0) return;
    sets.push('updated_at = now()');
    await this.db.query(
      `UPDATE crm_delivery_projects SET ${sets.join(', ')} WHERE id = $1::uuid`,
      params,
    );
  }

  async submitProject(
    projectId: string,
    patch: { status: string; needs_finance?: boolean },
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_delivery_projects
       SET status = $2,
           health_components_json = COALESCE(health_components_json, '{}'::jsonb) ||
             CASE WHEN $3::boolean THEN jsonb_build_object('needs_finance', true) ELSE '{}'::jsonb END,
           updated_at = now()
       WHERE id = $1::uuid`,
      [projectId, patch.status, patch.needs_finance ?? false],
    );
  }
}
