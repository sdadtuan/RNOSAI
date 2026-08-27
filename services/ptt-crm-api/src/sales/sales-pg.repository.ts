import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import {
  computeFunnelStats,
  normalizePipelineStage,
  pipelineStageLabel,
} from './sales-pipeline.util';
import {
  CreateMarketBody,
  CreatePartnerBody,
  CreateSalesPlanBody,
  CreateTrainingBody,
  FunnelStats,
  PipelineCaseRow,
  SALES_PLAN_STATUS_LABELS,
  SalesMarketRow,
  SalesPartnerRow,
  SalesPlanRow,
  SalesReportResponse,
  SalesSummaryResponse,
  SalesTrainingRow,
  SalesTransactionRow,
  normalizeSalesPlanStatus,
} from './sales.types';

const PARTNER_TYPE_LABELS: Record<string, string> = {
  dai_ly: 'Đại lý',
  ctv: 'Cộng tác viên',
  doi_tac: 'Đối tác',
};

const PARTNER_STATUS_LABELS: Record<string, string> = {
  active: 'Hoạt động',
  inactive: 'Ngưng',
  pending: 'Chờ duyệt',
};

const TRAINING_STATUS_LABELS: Record<string, string> = {
  planned: 'Dự kiến',
  done: 'Đã tổ chức',
  cancelled: 'Hủy',
};

const MARKET_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đã ban hành',
  archived: 'Lưu trữ',
};

const TX_TYPE_LABELS: Record<string, string> = {
  ban: 'Bán',
  mua: 'Mua',
  cho_thue: 'Cho thuê',
};

const TX_STAGE_LABELS: Record<string, string> = {
  tu_van: 'Tư vấn',
  dam_phan: 'Đàm phán',
  hop_dong: 'Hợp đồng',
  thu_tuc: 'Thủ tục',
  hoan_tat: 'Hoàn tất',
};

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

@Injectable()
export class SalesPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly crmConfig: CrmConfigService,
  ) {}

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
      CREATE TABLE IF NOT EXISTS crm_sales_plans (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        fiscal_year INTEGER NOT NULL,
        period_start DATE,
        period_end DATE,
        revenue_target_vnd BIGINT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        summary TEXT NOT NULL DEFAULT '',
        strategy_notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_sales_targets (
        id BIGSERIAL PRIMARY KEY,
        plan_id BIGINT NOT NULL REFERENCES crm_sales_plans(id) ON DELETE CASCADE,
        staff_id BIGINT,
        department_id BIGINT,
        target_value BIGINT NOT NULL DEFAULT 0,
        actual_value BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_sales_partners (
        id BIGSERIAL PRIMARY KEY,
        partner_type VARCHAR(32) NOT NULL DEFAULT 'ctv',
        name TEXT NOT NULL DEFAULT '',
        phone VARCHAR(64) NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        company TEXT NOT NULL DEFAULT '',
        territory TEXT NOT NULL DEFAULT '',
        commission_pct NUMERIC,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        assigned_staff_id BIGINT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_sales_trainings (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        training_date DATE,
        trainer_name TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL DEFAULT '',
        content_summary TEXT NOT NULL DEFAULT '',
        materials_url TEXT NOT NULL DEFAULT '',
        attendee_staff_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(32) NOT NULL DEFAULT 'planned',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_sales_market_research (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        research_date DATE,
        area TEXT NOT NULL DEFAULT '',
        property_type TEXT NOT NULL DEFAULT '',
        competitor_notes TEXT NOT NULL DEFAULT '',
        price_analysis TEXT NOT NULL DEFAULT '',
        strategy_proposal TEXT NOT NULL DEFAULT '',
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_sales_transactions (
        id BIGSERIAL PRIMARY KEY,
        case_id BIGINT,
        contract_id BIGINT,
        customer_id BIGINT,
        transaction_type VARCHAR(32) NOT NULL DEFAULT 'ban',
        property_ref TEXT NOT NULL DEFAULT '',
        stage VARCHAR(32) NOT NULL DEFAULT 'tu_van',
        deal_value_vnd BIGINT NOT NULL DEFAULT 0,
        assigned_staff_id BIGINT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_crm_sales_targets_plan
        ON crm_sales_targets(plan_id);
      CREATE INDEX IF NOT EXISTS idx_crm_sales_partners_status
        ON crm_sales_partners(status, name);
      CREATE INDEX IF NOT EXISTS idx_crm_sales_trainings_date
        ON crm_sales_trainings(training_date DESC);
      CREATE INDEX IF NOT EXISTS idx_crm_sales_market_status
        ON crm_sales_market_research(status, research_date DESC);
      CREATE INDEX IF NOT EXISTS idx_crm_sales_transactions_stage
        ON crm_sales_transactions(stage, updated_at DESC);
    `);
  }

  async computeFunnel(): Promise<FunnelStats> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT c.id, c.pipeline_stage, c.stage_entered_at, c.status, c.channel,
              c.priority, c.assigned_staff_id, c.lead_source, c.deal_value_vnd,
              c.created_at, st.name AS staff_name
       FROM crm_cases c
       LEFT JOIN crm_staff st ON st.id = c.assigned_staff_id`,
    );
    return computeFunnelStats(result.rows, this.crmConfig.toPipelineRuntime());
  }

  async fetchSummary(): Promise<SalesSummaryResponse> {
    await this.ensureSchema();
    const funnel = await this.computeFunnel();
    const planResult = await this.db.query(
      `SELECT * FROM crm_sales_plans
       WHERE status = 'active'
       ORDER BY fiscal_year DESC, id DESC LIMIT 1`,
    );

    let activePlan: SalesPlanRow | null = null;
    if (planResult.rows[0]) {
      activePlan = this.mapPlanRow(planResult.rows[0]);
      const targetResult = await this.db.query(
        `SELECT COALESCE(SUM(target_value), 0) AS t,
                COALESCE(SUM(actual_value), 0) AS a
         FROM crm_sales_targets WHERE plan_id = $1`,
        [activePlan.id],
      );
      activePlan.targets_sum = Number(targetResult.rows[0]?.t ?? 0);
      activePlan.actuals_sum = Number(targetResult.rows[0]?.a ?? 0);
      activePlan.revenue_progress_pct =
        activePlan.revenue_target_vnd > 0
          ? Math.round((100 * funnel.totals.won) / activePlan.revenue_target_vnd * 10) / 10
          : null;
    }

    const counts = await this.db.query(
      `SELECT
         (SELECT COUNT(*) FROM crm_sales_partners WHERE status = 'active') AS partners_active,
         (SELECT COUNT(*) FROM crm_sales_transactions WHERE stage <> 'hoan_tat') AS transactions_open,
         (SELECT COUNT(*) FROM crm_sales_trainings
            WHERE status = 'planned' AND training_date >= CURRENT_DATE) AS trainings_upcoming,
         (SELECT COUNT(*) FROM crm_sales_market_research
            WHERE status = 'published') AS market_reports,
         (SELECT COUNT(*) FROM crm_staff st
            JOIN crm_departments d ON d.id = st.department_id
            WHERE st.active IS TRUE
              AND (lower(d.code) = 'kd' OR lower(d.name) LIKE '%kinh doanh%')) AS kd_staff`,
    );
    const countRow = counts.rows[0] ?? {};
    const pipeline = this.crmConfig.getSalesPipelineConfig();
    return {
      funnel,
      active_plan: activePlan,
      counts: {
        partners_active: Number(countRow.partners_active ?? 0),
        transactions_open: Number(countRow.transactions_open ?? 0),
        trainings_upcoming: Number(countRow.trainings_upcoming ?? 0),
        market_reports: Number(countRow.market_reports ?? 0),
        kd_staff: Number(countRow.kd_staff ?? 0),
      },
      pipeline_labels: pipeline.labels,
      pipeline_stages: [...pipeline.stage_keys],
    };
  }

  async listPlans(): Promise<SalesPlanRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_sales_plans ORDER BY fiscal_year DESC, id DESC',
    );
    return result.rows.map((row) => this.mapPlanRow(row));
  }

  async createPlan(body: CreateSalesPlanBody): Promise<SalesPlanRow> {
    await this.ensureSchema();
    const title = String(body.title ?? '').trim().slice(0, 400);
    const now = new Date();
    let fiscalYear = Number(body.fiscal_year ?? now.getFullYear());
    if (!Number.isFinite(fiscalYear)) fiscalYear = now.getFullYear();
    fiscalYear = Math.max(1990, Math.min(2120, fiscalYear));
    let revenueTarget = Number(body.revenue_target_vnd ?? 0);
    if (!Number.isFinite(revenueTarget)) revenueTarget = 0;
    revenueTarget = Math.max(0, Math.min(revenueTarget, 9_999_999_999_999));
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_sales_plans (
         title, fiscal_year, period_start, period_end, revenue_target_vnd,
         status, summary, strategy_notes, created_at, updated_at
       ) VALUES ($1, $2, NULLIF($3, '')::date, NULLIF($4, '')::date, $5, $6, $7, $8,
                 $9::timestamptz, $9::timestamptz)
       RETURNING id`,
      [
        title,
        fiscalYear,
        String(body.period_start ?? '').trim().slice(0, 10),
        String(body.period_end ?? '').trim().slice(0, 10),
        revenueTarget,
        normalizeSalesPlanStatus(body.status),
        String(body.summary ?? '').trim().slice(0, 4000),
        String(body.strategy_notes ?? '').trim().slice(0, 8000),
        ts,
      ],
    );
    const plan = await this.getPlanById(Number(result.rows[0].id));
    if (!plan) throw new Error('Failed to create sales plan');
    return plan;
  }

  async listPartners(q = ''): Promise<SalesPartnerRow[]> {
    await this.ensureSchema();
    const search = String(q).trim();
    const result = search
      ? await this.db.query(
          `SELECT p.*, st.name AS assigned_staff_name
           FROM crm_sales_partners p
           LEFT JOIN crm_staff st ON st.id = p.assigned_staff_id
           WHERE p.name ILIKE $1 OR p.phone ILIKE $1 OR p.company ILIKE $1
           ORDER BY (p.status = 'active') DESC, lower(p.name)`,
          [`%${search}%`],
        )
      : await this.db.query(
          `SELECT p.*, st.name AS assigned_staff_name
           FROM crm_sales_partners p
           LEFT JOIN crm_staff st ON st.id = p.assigned_staff_id
           ORDER BY (p.status = 'active') DESC, lower(p.name)`,
        );
    return result.rows.map((row) => this.mapPartnerRow(row));
  }

  async createPartner(body: CreatePartnerBody): Promise<{ id: number }> {
    await this.ensureSchema();
    const ts = catalogTs();
    const commission =
      body.commission_pct != null && Number.isFinite(Number(body.commission_pct))
        ? Number(body.commission_pct)
        : null;
    const result = await this.db.query(
      `INSERT INTO crm_sales_partners (
         partner_type, name, phone, email, company, territory,
         commission_pct, status, assigned_staff_id, notes, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 $11::timestamptz, $11::timestamptz)
       RETURNING id`,
      [
        String(body.partner_type ?? 'ctv').slice(0, 32),
        String(body.name ?? '').trim().slice(0, 240),
        String(body.phone ?? '').slice(0, 64),
        String(body.email ?? '').slice(0, 240),
        String(body.company ?? '').slice(0, 240),
        String(body.territory ?? '').slice(0, 240),
        commission,
        String(body.status ?? 'active').slice(0, 32),
        body.assigned_staff_id != null ? Number(body.assigned_staff_id) : null,
        String(body.notes ?? '').slice(0, 2000),
        ts,
      ],
    );
    return { id: Number(result.rows[0].id) };
  }

  async listTrainings(): Promise<SalesTrainingRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_sales_trainings ORDER BY training_date DESC, id DESC',
    );
    return result.rows.map((row) => this.mapTrainingRow(row));
  }

  async createTraining(body: CreateTrainingBody): Promise<{ id: number }> {
    await this.ensureSchema();
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_sales_trainings (
         title, training_date, trainer_name, topic, content_summary,
         materials_url, attendee_staff_ids, status, created_at, updated_at
       ) VALUES ($1, NULLIF($2, '')::date, $3, $4, $5, $6, '[]'::jsonb, $7,
                 $8::timestamptz, $8::timestamptz)
       RETURNING id`,
      [
        String(body.title ?? '').trim().slice(0, 400),
        String(body.training_date ?? '').slice(0, 10),
        String(body.trainer_name ?? '').slice(0, 240),
        String(body.topic ?? '').slice(0, 400),
        String(body.content_summary ?? '').slice(0, 8000),
        String(body.materials_url ?? '').slice(0, 500),
        String(body.status ?? 'planned').slice(0, 32),
        ts,
      ],
    );
    return { id: Number(result.rows[0].id) };
  }

  async listMarketResearch(): Promise<SalesMarketRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_sales_market_research ORDER BY research_date DESC, id DESC',
    );
    return result.rows.map((row) => this.mapMarketRow(row));
  }

  async createMarketResearch(body: CreateMarketBody): Promise<{ id: number }> {
    await this.ensureSchema();
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_sales_market_research (
         title, research_date, area, property_type, competitor_notes,
         price_analysis, strategy_proposal, status, created_at, updated_at
       ) VALUES ($1, NULLIF($2, '')::date, $3, $4, $5, $6, $7, $8,
                 $9::timestamptz, $9::timestamptz)
       RETURNING id`,
      [
        String(body.title ?? '').trim().slice(0, 400),
        String(body.research_date ?? '').slice(0, 10),
        String(body.area ?? '').slice(0, 240),
        String(body.property_type ?? '').slice(0, 240),
        String(body.competitor_notes ?? '').slice(0, 8000),
        String(body.price_analysis ?? '').slice(0, 8000),
        String(body.strategy_proposal ?? '').slice(0, 8000),
        String(body.status ?? 'draft').slice(0, 32),
        ts,
      ],
    );
    return { id: Number(result.rows[0].id) };
  }

  async listTransactions(): Promise<SalesTransactionRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT tx.*, cu.name AS customer_name, st.name AS assigned_staff_name,
              c.title AS case_title
       FROM crm_sales_transactions tx
       LEFT JOIN crm_customers cu ON cu.id = tx.customer_id
       LEFT JOIN crm_staff st ON st.id = tx.assigned_staff_id
       LEFT JOIN crm_cases c ON c.id = tx.case_id
       ORDER BY tx.updated_at DESC, tx.id DESC
       LIMIT 300`,
    );
    return result.rows.map((row) => this.mapTransactionRow(row));
  }

  async listPipelineCases(stage?: string): Promise<PipelineCaseRow[]> {
    await this.ensureSchema();
    const runtime = this.crmConfig.toPipelineRuntime();
    const stageNorm = stage ? normalizePipelineStage(stage, runtime) : null;
    const result = await this.db.query(
      `SELECT c.id, c.title, c.pipeline_stage, c.deal_value_vnd, c.status,
              c.assigned_staff_id, c.customer_id, c.created_at, c.stage_entered_at,
              cu.name AS customer_name, st.name AS staff_name
       FROM crm_cases c
       LEFT JOIN crm_customers cu ON cu.id = c.customer_id
       LEFT JOIN crm_staff st ON st.id = c.assigned_staff_id
       ${stageNorm ? 'WHERE c.pipeline_stage = $1' : ''}
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT 200`,
      stageNorm ? [stageNorm] : [],
    );
    return result.rows.map((row) => {
      const pipelineStage = normalizePipelineStage(
        String(row.pipeline_stage ?? ''),
        runtime,
      );
      return {
        id: Number(row.id),
        title: String(row.title ?? ''),
        pipeline_stage: pipelineStage,
        pipeline_stage_label: pipelineStageLabel(pipelineStage, runtime),
        is_terminal: runtime.terminalStages.has(pipelineStage),
        deal_value_vnd: Number(row.deal_value_vnd ?? 0),
        status: String(row.status ?? ''),
        assigned_staff_id:
          row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
        customer_id: row.customer_id != null ? Number(row.customer_id) : null,
        customer_name: String(row.customer_name ?? ''),
        staff_name: String(row.staff_name ?? ''),
        created_at: text(row.created_at),
        stage_entered_at: text(row.stage_entered_at),
      };
    });
  }

  async fetchSalesReport(): Promise<SalesReportResponse> {
    await this.ensureSchema();
    const funnel = await this.computeFunnel();
    const staffPerformance = Object.entries(funnel.by_staff ?? {})
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => (b.won ?? 0) - (a.won ?? 0));
    const [caseRevenue, transactionRevenue, targets] = await Promise.all([
      this.db.query(
        `SELECT COALESCE(SUM(deal_value_vnd), 0) AS v
         FROM crm_cases WHERE pipeline_stage = 'chot'`,
      ),
      this.db.query(
        `SELECT COALESCE(SUM(deal_value_vnd), 0) AS v
         FROM crm_sales_transactions WHERE stage = 'hoan_tat'`,
      ),
      this.db.query(
        `SELECT t.*, st.name AS staff_name, d.name AS department_name
         FROM crm_sales_targets t
         LEFT JOIN crm_staff st ON st.id = t.staff_id
         LEFT JOIN crm_departments d ON d.id = t.department_id
         ORDER BY t.id DESC
         LIMIT 50`,
      ),
    ]);
    return {
      funnel_totals: funnel.totals,
      staff_performance: staffPerformance,
      revenue_closed_cases: Number(caseRevenue.rows[0]?.v ?? 0),
      revenue_closed_tx: Number(transactionRevenue.rows[0]?.v ?? 0),
      targets: targets.rows.map((row) => ({
        ...row,
        achievement_pct:
          Number(row.target_value ?? 0) > 0
            ? Math.round(
                (100 * Number(row.actual_value ?? 0)) /
                  Number(row.target_value),
              ) / 10
            : null,
      })),
      bottlenecks: funnel.bottlenecks,
    };
  }

  async getPlanById(planId: number): Promise<SalesPlanRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_sales_plans WHERE id = $1',
      [planId],
    );
    return result.rows[0] ? this.mapPlanRow(result.rows[0]) : null;
  }

  private parseAttendeeIds(raw: unknown): number[] {
    if (Array.isArray(raw)) {
      return raw.map((value) => Number(value)).filter(Number.isFinite);
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        return this.parseAttendeeIds(JSON.parse(raw));
      } catch {
        return [];
      }
    }
    return [];
  }

  private mapPartnerRow(row: Record<string, unknown>): SalesPartnerRow {
    const partnerType = String(row.partner_type ?? 'ctv');
    const status = String(row.status ?? 'active');
    return {
      id: Number(row.id),
      partner_type: partnerType,
      partner_type_label: PARTNER_TYPE_LABELS[partnerType] ?? partnerType,
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      company: String(row.company ?? ''),
      territory: String(row.territory ?? ''),
      commission_pct:
        row.commission_pct != null ? Number(row.commission_pct) : null,
      status,
      status_label: PARTNER_STATUS_LABELS[status] ?? status,
      assigned_staff_id:
        row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
      assigned_staff_name: String(row.assigned_staff_name ?? ''),
      notes: String(row.notes ?? ''),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }

  private mapTrainingRow(row: Record<string, unknown>): SalesTrainingRow {
    const status = String(row.status ?? 'planned');
    return {
      id: Number(row.id),
      title: String(row.title ?? ''),
      training_date: text(row.training_date).slice(0, 10),
      trainer_name: String(row.trainer_name ?? ''),
      topic: String(row.topic ?? ''),
      content_summary: String(row.content_summary ?? ''),
      materials_url: String(row.materials_url ?? ''),
      attendee_staff_ids_list: this.parseAttendeeIds(row.attendee_staff_ids),
      status,
      status_label: TRAINING_STATUS_LABELS[status] ?? status,
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }

  private mapMarketRow(row: Record<string, unknown>): SalesMarketRow {
    const status = String(row.status ?? 'draft');
    return {
      id: Number(row.id),
      title: String(row.title ?? ''),
      research_date: text(row.research_date).slice(0, 10),
      area: String(row.area ?? ''),
      property_type: String(row.property_type ?? ''),
      competitor_notes: String(row.competitor_notes ?? ''),
      price_analysis: String(row.price_analysis ?? ''),
      strategy_proposal: String(row.strategy_proposal ?? ''),
      status,
      status_label: MARKET_STATUS_LABELS[status] ?? status,
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }

  private mapTransactionRow(
    row: Record<string, unknown>,
  ): SalesTransactionRow {
    const transactionType = String(row.transaction_type ?? 'ban');
    const stage = String(row.stage ?? 'tu_van');
    return {
      id: Number(row.id),
      case_id: row.case_id != null ? Number(row.case_id) : null,
      contract_id: row.contract_id != null ? Number(row.contract_id) : null,
      customer_id: row.customer_id != null ? Number(row.customer_id) : null,
      customer_name: String(row.customer_name ?? ''),
      transaction_type: transactionType,
      transaction_type_label:
        TX_TYPE_LABELS[transactionType] ?? transactionType,
      property_ref: String(row.property_ref ?? ''),
      stage,
      stage_label: TX_STAGE_LABELS[stage] ?? stage,
      deal_value_vnd: Number(row.deal_value_vnd ?? 0),
      assigned_staff_id:
        row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
      assigned_staff_name: String(row.assigned_staff_name ?? ''),
      case_title: String(row.case_title ?? ''),
      notes: String(row.notes ?? ''),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }

  private mapPlanRow(row: Record<string, unknown>): SalesPlanRow {
    const status = String(row.status ?? 'draft');
    return {
      id: Number(row.id),
      title: String(row.title ?? ''),
      fiscal_year: Number(row.fiscal_year ?? 0),
      period_start: text(row.period_start).slice(0, 10),
      period_end: text(row.period_end).slice(0, 10),
      revenue_target_vnd: Number(row.revenue_target_vnd ?? 0),
      status,
      status_label: SALES_PLAN_STATUS_LABELS[status] ?? status,
      summary: String(row.summary ?? ''),
      strategy_notes: String(row.strategy_notes ?? ''),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }
}
