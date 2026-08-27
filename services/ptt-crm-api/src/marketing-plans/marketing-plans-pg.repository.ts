import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateMarketingPlanBody,
  CRM_MARKETING_PLAN_PRIORITY_LABELS,
  CRM_MARKETING_PLAN_STATUS_LABELS,
  MarketingPlanCampaignRow,
  MarketingPlanMilestoneRow,
  MarketingPlanRow,
  normalizeMarketingPlanPriority,
  normalizeMarketingPlanStatus,
  PatchMarketingPlanBody,
} from './marketing-plans.types';

const PLAN_LIST_SELECT = `
SELECT p.*,
       COALESCE(st.name, '') AS owner_name,
       (SELECT COUNT(*)::int FROM crm_marketing_plan_campaigns mpc WHERE mpc.plan_id = p.id)
         AS linked_campaign_count,
       (SELECT COUNT(*)::int FROM crm_marketing_plan_milestones mm WHERE mm.plan_id = p.id)
         AS milestone_total,
       (SELECT COUNT(*)::int FROM crm_marketing_plan_milestones mm
        WHERE mm.plan_id = p.id AND mm.status = 'done') AS milestone_done
FROM crm_marketing_plans p
LEFT JOIN crm_staff st ON st.id = p.owner_staff_id
`;

const PLAN_DETAIL_SELECT = `
SELECT p.*, COALESCE(st.name, '') AS owner_name
FROM crm_marketing_plans p
LEFT JOIN crm_staff st ON st.id = p.owner_staff_id
`;

function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function jsonText(value: unknown, fallback: '[]' | '{}'): string {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

@Injectable()
export class MarketingPlansPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

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
    this.schemaReady = null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_marketing_plans (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        plan_kind TEXT NOT NULL DEFAULT 'standalone',
        lead_id BIGINT,
        presales_id BIGINT,
        lifecycle_id BIGINT,
        source_plan_id BIGINT,
        north_star TEXT NOT NULL DEFAULT '',
        objectives TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        strategy_framework_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        target_market_prof_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        target_market_steps4_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE crm_marketing_plans ALTER COLUMN lead_id DROP NOT NULL;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS fiscal_year INTEGER NOT NULL DEFAULT 2026;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS period_label TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS pillars_json JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS audiences TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS channels_focus_json JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS budget_planned_vnd BIGINT NOT NULL DEFAULT 0;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS budget_actual_vnd BIGINT NOT NULL DEFAULT 0;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS success_metrics_json JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS risks_notes TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS owner_staff_id BIGINT;
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS start_date TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_marketing_plans ADD COLUMN IF NOT EXISTS end_date TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_marketing_plans
        ADD COLUMN IF NOT EXISTS khtn_market_research_json JSONB NOT NULL DEFAULT '{}'::jsonb;

      CREATE TABLE IF NOT EXISTS crm_campaigns (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS crm_marketing_plan_campaigns (
        plan_id BIGINT NOT NULL REFERENCES crm_marketing_plans(id) ON DELETE CASCADE,
        campaign_id BIGINT NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
        PRIMARY KEY (plan_id, campaign_id)
      );

      CREATE TABLE IF NOT EXISTS crm_marketing_plan_milestones (
        id SERIAL PRIMARY KEY,
        plan_id BIGINT NOT NULL REFERENCES crm_marketing_plans(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        due_date TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        owner_staff_id BIGINT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crm_marketing_plan_milestones_plan
        ON crm_marketing_plan_milestones (plan_id, position, id);
    `);
  }

  async listPlans(opts: {
    fiscalYear?: number;
    status?: string;
    q?: string;
  }): Promise<MarketingPlanRow[]> {
    await this.ensureSchema();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (opts.fiscalYear != null) {
      params.push(opts.fiscalYear);
      clauses.push(`p.fiscal_year = $${params.length}`);
    }
    if (opts.status && opts.status !== 'all') {
      params.push(opts.status);
      clauses.push(`p.status = $${params.length}`);
    }
    if (opts.q) {
      params.push(`%${opts.q}%`);
      clauses.push(
        `(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length} OR p.period_label ILIKE $${params.length})`,
      );
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.query(
      `${PLAN_LIST_SELECT}
       ${whereSql}
       ORDER BY p.fiscal_year DESC, p.updated_at DESC, p.id DESC
       LIMIT 300`,
      params,
    );
    return result.rows.map((row) => this.mapPlanRow(row as Record<string, unknown>));
  }

  async getPlanById(planId: number): Promise<MarketingPlanRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(`${PLAN_DETAIL_SELECT} WHERE p.id = $1`, [planId]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPlanRow(row) : null;
  }

  async listMilestones(planId: number): Promise<MarketingPlanMilestoneRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_marketing_plan_milestones
       WHERE plan_id = $1
       ORDER BY position ASC, id ASC`,
      [planId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      plan_id: Number(row.plan_id),
      position: Number(row.position ?? 0),
      title: text(row.title),
      description: text(row.description),
      due_date: text(row.due_date),
      status: text(row.status),
      owner_staff_id: row.owner_staff_id != null ? Number(row.owner_staff_id) : null,
      notes: text(row.notes),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    }));
  }

  async listCampaigns(planId: number): Promise<MarketingPlanCampaignRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT c.*
       FROM crm_marketing_plan_campaigns l
       JOIN crm_campaigns c ON c.id = l.campaign_id
       WHERE l.plan_id = $1
       ORDER BY lower(c.name) ASC`,
      [planId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      id: Number(row.id),
      name: text(row.name),
      code: text(row.code),
      status: text(row.status),
      channel: text(row.channel),
    }));
  }

  async createPlan(body: CreateMarketingPlanBody): Promise<MarketingPlanRow> {
    await this.ensureSchema();
    const name = text(body.name).trim().slice(0, 400);
    const code = text(body.code).trim().slice(0, 64);
    const status = normalizeMarketingPlanStatus(body.status);
    const priority = normalizeMarketingPlanPriority(body.priority);
    const currentYear = new Date().getFullYear();
    let fiscalYear = Number(body.fiscal_year ?? currentYear);
    if (!Number.isFinite(fiscalYear)) fiscalYear = currentYear;
    fiscalYear = Math.max(1990, Math.min(2120, fiscalYear));
    let budgetPlanned = Number(body.budget_planned_vnd ?? 0);
    if (!Number.isFinite(budgetPlanned)) budgetPlanned = 0;
    budgetPlanned = Math.max(0, Math.min(budgetPlanned, 9_999_999_999_999));
    let budgetActual = Number(body.budget_actual_vnd ?? 0);
    if (!Number.isFinite(budgetActual)) budgetActual = 0;
    budgetActual = Math.max(0, Math.min(budgetActual, 9_999_999_999_999));

    let ownerId: number | null = null;
    const candidateOwnerId = Number(body.owner_staff_id ?? 0);
    if (Number.isFinite(candidateOwnerId) && candidateOwnerId > 0) {
      const owner = await this.db.query('SELECT id FROM crm_staff WHERE id = $1 LIMIT 1', [
        candidateOwnerId,
      ]);
      if (owner.rows[0]) ownerId = candidateOwnerId;
    }

    const inserted = await this.db.query(
      `INSERT INTO crm_marketing_plans (
         code, name, status, priority, fiscal_year, period_label, north_star, objectives,
         pillars_json, audiences, channels_focus_json, budget_planned_vnd, budget_actual_vnd,
         success_metrics_json, risks_notes, owner_staff_id, start_date, end_date, notes,
         strategy_framework_json, target_market_prof_json, target_market_steps4_json,
         khtn_market_research_json, plan_kind, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, $9, '[]'::jsonb, $10, $11,
         '[]'::jsonb, $12, $13, $14, $15, $16, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         '{}'::jsonb, 'standalone', NOW(), NOW()
       )
       RETURNING id`,
      [
        code,
        name,
        status,
        priority,
        fiscalYear,
        text(body.period_label).trim().slice(0, 120),
        text(body.north_star).trim().slice(0, 2000),
        text(body.objectives).trim().slice(0, 32000),
        text(body.audiences).trim().slice(0, 32000),
        budgetPlanned,
        budgetActual,
        text(body.risks_notes).trim().slice(0, 32000),
        ownerId,
        text(body.start_date).trim().slice(0, 32),
        text(body.end_date).trim().slice(0, 32),
        text(body.notes).trim().slice(0, 32000),
      ],
    );
    const plan = await this.getPlanById(Number(inserted.rows[0]?.id));
    if (!plan) throw new Error('Failed to create marketing plan');
    return plan;
  }

  async patchPlan(
    planId: number,
    body: PatchMarketingPlanBody,
  ): Promise<MarketingPlanRow | null> {
    await this.ensureSchema();
    const sets: string[] = [];
    const params: unknown[] = [planId];

    if ('khtn_market_research_json' in body && typeof body.khtn_market_research_json === 'string') {
      params.push(body.khtn_market_research_json);
      sets.push(`khtn_market_research_json = $${params.length}::jsonb`);
    }
    if ('name' in body && typeof body.name === 'string') {
      params.push(body.name.trim().slice(0, 400));
      sets.push(`name = $${params.length}`);
    }
    if ('status' in body) {
      params.push(normalizeMarketingPlanStatus(body.status));
      sets.push(`status = $${params.length}`);
    }
    if ('priority' in body) {
      params.push(normalizeMarketingPlanPriority(body.priority));
      sets.push(`priority = $${params.length}`);
    }
    if ('notes' in body && typeof body.notes === 'string') {
      params.push(body.notes.trim().slice(0, 32000));
      sets.push(`notes = $${params.length}`);
    }
    if ('objectives' in body && typeof body.objectives === 'string') {
      params.push(body.objectives.trim().slice(0, 32000));
      sets.push(`objectives = $${params.length}`);
    }

    sets.push('updated_at = NOW()');
    const updated = await this.db.query(
      `UPDATE crm_marketing_plans
       SET ${sets.join(', ')}
       WHERE id = $1
       RETURNING id`,
      params,
    );
    if (!updated.rows[0]) return null;
    return this.getPlanById(planId);
  }

  private mapPlanRow(row: Record<string, unknown>): MarketingPlanRow {
    const status = text(row.status);
    const priority = text(row.priority);
    return {
      id: Number(row.id),
      code: text(row.code),
      name: text(row.name),
      status,
      status_label: CRM_MARKETING_PLAN_STATUS_LABELS[status] ?? status,
      priority,
      priority_label: CRM_MARKETING_PLAN_PRIORITY_LABELS[priority] ?? priority,
      fiscal_year: Number(row.fiscal_year ?? 0),
      period_label: text(row.period_label),
      north_star: text(row.north_star),
      objectives: text(row.objectives),
      pillars_json: jsonText(row.pillars_json, '[]'),
      audiences: text(row.audiences),
      channels_focus_json: jsonText(row.channels_focus_json, '[]'),
      budget_planned_vnd: Number(row.budget_planned_vnd ?? 0),
      budget_actual_vnd: Number(row.budget_actual_vnd ?? 0),
      success_metrics_json: jsonText(row.success_metrics_json, '[]'),
      risks_notes: text(row.risks_notes),
      owner_staff_id: row.owner_staff_id != null ? Number(row.owner_staff_id) : null,
      owner_name: text(row.owner_name),
      start_date: text(row.start_date),
      end_date: text(row.end_date),
      notes: text(row.notes),
      strategy_framework_json: jsonText(row.strategy_framework_json, '{}'),
      target_market_prof_json: jsonText(row.target_market_prof_json, '{}'),
      target_market_steps4_json: jsonText(row.target_market_steps4_json, '{}'),
      khtn_market_research_json: jsonText(row.khtn_market_research_json, '{}'),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
      linked_campaign_count:
        row.linked_campaign_count != null ? Number(row.linked_campaign_count) : undefined,
      milestone_total: row.milestone_total != null ? Number(row.milestone_total) : undefined,
      milestone_done: row.milestone_done != null ? Number(row.milestone_done) : undefined,
    };
  }
}
