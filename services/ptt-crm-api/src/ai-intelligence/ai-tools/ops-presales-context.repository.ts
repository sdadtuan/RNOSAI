import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import {
  OFFICIAL_TMMT_CORE_KEYS,
  TARGET_MARKET_PROF_KEYS,
  parsePlanContent,
  validateOfficialTmmt,
} from '../../service-lifecycle/lifecycle-marketing-plan.util';
import { APPROVED_INTERNAL_PLUS } from '../../market-research/market-research.constants';

export type PresalesLeadRow = {
  id: number;
  full_name: string;
  status: string;
  source: string;
  owner_name: string;
  created_at: string;
};

export type PresalesIntakeRow = {
  id: number;
  bant_total: number;
  decision: string;
  completed_at: string;
  ai_summary: string;
  answers_json: Record<string, unknown>;
  lead_id: number | null;
  lifecycle_id: number | null;
};

export type PresalesLifecycleDetail = {
  id: number;
  lead_id: number | null;
  contract_id: number | null;
  marketing_plan_id: number | null;
  stage: string;
  status: string;
  service_slug: string;
  assigned_am: number | null;
  assigned_sp: number | null;
  agency_client_id: string | null;
};

export type PresalesContractRow = {
  id: number;
  title: string;
  amount_vnd: number;
  agency_client_id: string;
};

export type PresalesProposalRow = {
  id: number;
  quote_code: string | null;
  payable_vnd: number | null;
  status: string;
};

@Injectable()
export class OpsPresalesContextRepository implements OnModuleDestroy {
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

  async resolveClientId(raw: string): Promise<{ id: string; name: string; code: string; status: string } | null> {
    const key = String(raw ?? '').trim();
    if (!key) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const r = await this.db.query(
      isUuid
        ? `SELECT id::text, name, code, status FROM clients WHERE id = $1::uuid LIMIT 1`
        : `SELECT id::text, name, code, status FROM clients WHERE UPPER(code) = UPPER($1) LIMIT 1`,
      [key],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      code: String(row.code ?? ''),
      status: String(row.status ?? ''),
    };
  }

  async getLifecycleDetail(id: number): Promise<PresalesLifecycleDetail | null> {
    const r = await this.db.query(
      `SELECT sl.id, sl.lead_id, sl.contract_id, sl.marketing_plan_id, sl.stage, sl.status,
              sl.service_slug, sl.assigned_am, sl.assigned_sp,
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
      lead_id: row.lead_id == null ? null : Number(row.lead_id),
      contract_id: row.contract_id == null ? null : Number(row.contract_id),
      marketing_plan_id: row.marketing_plan_id == null ? null : Number(row.marketing_plan_id),
      stage: String(row.stage ?? ''),
      status: String(row.status ?? ''),
      service_slug: String(row.service_slug ?? ''),
      assigned_am: row.assigned_am == null ? null : Number(row.assigned_am),
      assigned_sp: row.assigned_sp == null ? null : Number(row.assigned_sp),
      agency_client_id: String(row.agency_client_id ?? '').trim() || null,
    };
  }

  async findLifecycleByLead(leadId: number): Promise<PresalesLifecycleDetail | null> {
    const r = await this.db.query(
      `SELECT id FROM crm_service_lifecycle
       WHERE lead_id = $1 AND status IN ('active', 'draft')
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 1`,
      [leadId],
    );
    const id = r.rows[0]?.id;
    return id != null ? this.getLifecycleDetail(Number(id)) : null;
  }

  async findLifecycleByPlan(planId: number): Promise<PresalesLifecycleDetail | null> {
    const r = await this.db.query(
      `SELECT id FROM crm_service_lifecycle WHERE marketing_plan_id = $1 LIMIT 1`,
      [planId],
    );
    if (r.rows[0]?.id != null) return this.getLifecycleDetail(Number(r.rows[0].id));
    const r2 = await this.db.query(
      `SELECT lifecycle_id FROM crm_marketing_plans WHERE id = $1 LIMIT 1`,
      [planId],
    );
    const lcId = r2.rows[0]?.lifecycle_id;
    return lcId != null ? this.getLifecycleDetail(Number(lcId)) : null;
  }

  async findLifecycleByClient(clientId: string): Promise<PresalesLifecycleDetail | null> {
    const r = await this.db.query(
      `SELECT sl.id
       FROM crm_service_lifecycle sl
       INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
       WHERE TRIM(COALESCE(ct.agency_client_id, '')) = $1
         AND sl.status IN ('active', 'draft')
       ORDER BY CASE WHEN sl.status = 'active' THEN 0 ELSE 1 END, sl.updated_at DESC
       LIMIT 1`,
      [clientId.trim()],
    );
    const id = r.rows[0]?.id;
    return id != null ? this.getLifecycleDetail(Number(id)) : null;
  }

  async getLead(leadId: number): Promise<PresalesLeadRow | null> {
    const r = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, COALESCE(l.full_name, '') AS full_name,
              COALESCE(l.status, '') AS status, COALESCE(l.source, '') AS source,
              COALESCE(l.created_at::text, '') AS created_at,
              COALESCE(
                (SELECT COALESCE(s.full_name, s.name, '') FROM crm_staff s WHERE s.id = l.owner_id LIMIT 1),
                ''
              ) AS owner_name
       FROM crm_leads l
       WHERE l.sqlite_lead_id = $1
       LIMIT 1`,
      [leadId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      full_name: String(row.full_name ?? ''),
      status: String(row.status ?? ''),
      source: String(row.source ?? ''),
      owner_name: String(row.owner_name ?? ''),
      created_at: String(row.created_at ?? ''),
    };
  }

  async getLatestCompletedIntake(leadId: number | null, lifecycleId: number | null): Promise<PresalesIntakeRow | null> {
    const clauses: string[] = [`s.status = 'completed'`];
    const params: unknown[] = [];
    if (leadId != null) {
      params.push(leadId);
      clauses.push(`s.lead_id = $${params.length}`);
    }
    if (lifecycleId != null) {
      params.push(lifecycleId);
      clauses.push(`(s.lifecycle_id = $${params.length} OR s.lifecycle_id IN (
        SELECT id FROM crm_service_lifecycle WHERE sqlite_lifecycle_id = $${params.length}
      ))`);
    }
    if (params.length === 0) return null;
    const r = await this.db.query(
      `SELECT s.id, s.bant_total, s.decision, COALESCE(s.completed_at::text, '') AS completed_at,
              COALESCE(s.ai_summary, '') AS ai_summary, COALESCE(s.answers_json, '{}'::jsonb) AS answers_json,
              s.lead_id, s.lifecycle_id
       FROM crm_lead_intake_sessions s
       WHERE ${clauses.join(' AND ')}
       ORDER BY s.completed_at DESC NULLS LAST, s.id DESC
       LIMIT 1`,
      params,
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      bant_total: Number(row.bant_total ?? 0),
      decision: String(row.decision ?? ''),
      completed_at: String(row.completed_at ?? ''),
      ai_summary: String(row.ai_summary ?? ''),
      answers_json:
        row.answers_json && typeof row.answers_json === 'object'
          ? (row.answers_json as Record<string, unknown>)
          : {},
      lead_id: row.lead_id == null ? null : Number(row.lead_id),
      lifecycle_id: row.lifecycle_id == null ? null : Number(row.lifecycle_id),
    };
  }

  async getOfficialPlan(planId: number | null): Promise<Record<string, unknown> | null> {
    if (planId == null) return null;
    const r = await this.db.query(
      `SELECT id, name, north_star, objectives, strategy_framework_json, target_market_prof_json,
              status, period_label, lifecycle_id
       FROM crm_marketing_plans WHERE id = $1 LIMIT 1`,
      [planId],
    );
    return (r.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async getContract(contractId: number | null): Promise<PresalesContractRow | null> {
    if (contractId == null) return null;
    const r = await this.db.query(
      `SELECT id, COALESCE(title, '') AS title, COALESCE(amount_vnd, 0) AS amount_vnd,
              COALESCE(agency_client_id, '') AS agency_client_id
       FROM crm_contracts WHERE id = $1 LIMIT 1`,
      [contractId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      title: String(row.title ?? ''),
      amount_vnd: Number(row.amount_vnd ?? 0),
      agency_client_id: String(row.agency_client_id ?? ''),
    };
  }

  async listProposals(opts: {
    leadId?: number | null;
    clientId?: string | null;
  }): Promise<PresalesProposalRow[]> {
    const clauses: string[] = ['1=1'];
    const params: unknown[] = [];
    if (opts.leadId != null) {
      params.push(opts.leadId);
      clauses.push(`p.lead_id = $${params.length}`);
    }
    if (opts.clientId) {
      params.push(opts.clientId);
      clauses.push(`p.agency_client_id::text = $${params.length}`);
    }
    if (params.length === 0) return [];
    try {
      const r = await this.db.query(
        `SELECT p.id, p.quote_code, p.status,
                COALESCE(v.payable_vnd, 0) AS payable_vnd
         FROM crm_proposals p
         LEFT JOIN crm_proposal_versions v ON v.id = p.current_version_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY p.id DESC
         LIMIT 40`,
        params,
      );
      return r.rows.map((row) => ({
        id: Number(row.id),
        quote_code: row.quote_code == null ? null : String(row.quote_code),
        payable_vnd: row.payable_vnd == null ? null : Number(row.payable_vnd),
        status: String(row.status ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async getPresalesL2Docs(leadId: number | null): Promise<Record<string, boolean>> {
    if (leadId == null) return {};
    try {
      const r = await this.db.query(
        `SELECT l2_docs_json FROM crm_lead_presales WHERE lead_id = $1 LIMIT 1`,
        [leadId],
      );
      const raw = r.rows[0]?.l2_docs_json;
      if (!raw || typeof raw !== 'object') return {};
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        out[k] = Boolean(v);
      }
      return out;
    } catch {
      return {};
    }
  }

  async listApprovedInsightIds(clientId: string | null, _leadId: number | null): Promise<number[]> {
    const statuses = [...APPROVED_INTERNAL_PLUS];
    if (!clientId) return [];
    try {
      const r = await this.db.query(
        `SELECT i.id
         FROM crm_research_insights i
         INNER JOIN crm_research_projects p ON p.id = i.project_id
         WHERE p.client_id::text = $1
           AND i.status = ANY($2::text[])
         ORDER BY i.id DESC
         LIMIT 50`,
        [clientId, statuses],
      );
      return r.rows.map((row) => Number(row.id));
    } catch {
      return [];
    }
  }

  async countHubCampaignMaps(clientId: string | null): Promise<number> {
    if (!clientId) return 0;
    try {
      const r = await this.db.query(
        `SELECT COUNT(*)::int AS n FROM hub_campaign_map
         WHERE client_id = $1::uuid AND COALESCE(active, true) = true`,
        [clientId],
      );
      return Number(r.rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }

  async staffName(staffId: number | null): Promise<string> {
    if (staffId == null) return '';
    try {
      const r = await this.db.query(
        `SELECT COALESCE(full_name, name, email, '') AS name FROM crm_staff WHERE id = $1 LIMIT 1`,
        [staffId],
      );
      return String(r.rows[0]?.name ?? '').trim();
    } catch {
      try {
        const r = await this.db.query(
          `SELECT COALESCE(full_name, name, '') AS name FROM staff WHERE id = $1 LIMIT 1`,
          [staffId],
        );
        return String(r.rows[0]?.name ?? '').trim();
      } catch {
        return '';
      }
    }
  }

  /** Expose util helpers for tests without circular imports in service. */
  parseOfficialPlan(plan: Record<string, unknown> | null) {
    return parsePlanContent(plan);
  }

  validateOfficialPlan(plan: Record<string, unknown> | null) {
    return validateOfficialTmmt(plan);
  }

  tmmtKeys() {
    return { core: OFFICIAL_TMMT_CORE_KEYS, all: TARGET_MARKET_PROF_KEYS };
  }
}
