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
  campaign_id: number | null;
  campaign_code: string;
  campaign_name: string;
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
                (SELECT COALESCE(s.name, s.email, '') FROM crm_staff s WHERE s.id = l.owner_id LIMIT 1),
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
    const idClauses: string[] = [];
    if (leadId != null) {
      params.push(leadId);
      idClauses.push(`s.lead_id = $${params.length}`);
    }
    if (lifecycleId != null) {
      params.push(lifecycleId);
      idClauses.push(`s.lifecycle_id = $${params.length}`);
    }
    if (idClauses.length === 0) return null;
    // Match by lead OR lifecycle — intake rows often store only lead_id.
    clauses.push(`(${idClauses.join(' OR ')})`);
    try {
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
    } catch {
      return null;
    }
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

  /** P8.4 — richest TMMT on the same lifecycle (fallback when official plan was emptied on activate). */
  async findRichestTmmtPlanForLifecycle(
    lifecycleId: number | null,
    preferPlanId?: number | null,
  ): Promise<Record<string, unknown> | null> {
    if (lifecycleId == null) return null;
    try {
      const r = await this.db.query(
        `SELECT id, name, north_star, objectives, strategy_framework_json, target_market_prof_json,
                status, period_label, lifecycle_id,
                (
                  SELECT COUNT(*)::int FROM jsonb_each_text(COALESCE(target_market_prof_json, '{}'::jsonb)) e
                  WHERE NULLIF(TRIM(e.value), '') IS NOT NULL
                ) AS filled_n
         FROM crm_marketing_plans
         WHERE lifecycle_id = $1
            OR id = $2
         ORDER BY filled_n DESC, updated_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [lifecycleId, preferPlanId ?? 0],
      );
      return (r.rows[0] as Record<string, unknown> | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async getContract(contractId: number | null): Promise<PresalesContractRow | null> {
    if (contractId == null) return null;
    try {
      const r = await this.db.query(
        `SELECT ct.id, COALESCE(ct.title, '') AS title, COALESCE(ct.amount_vnd, 0) AS amount_vnd,
                COALESCE(ct.agency_client_id, '') AS agency_client_id,
                ct.campaign_id,
                COALESCE(camp.code, '') AS campaign_code,
                COALESCE(camp.name, '') AS campaign_name
         FROM crm_contracts ct
         LEFT JOIN crm_campaigns camp ON camp.id = ct.campaign_id
         WHERE ct.id = $1 LIMIT 1`,
        [contractId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        title: String(row.title ?? ''),
        amount_vnd: Number(row.amount_vnd ?? 0),
        agency_client_id: String(row.agency_client_id ?? ''),
        campaign_id: row.campaign_id != null ? Number(row.campaign_id) : null,
        campaign_code: String(row.campaign_code ?? ''),
        campaign_name: String(row.campaign_name ?? ''),
      };
    } catch {
      // Older schemas without campaign_id — soft-fail.
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
        campaign_id: null,
        campaign_code: '',
        campaign_name: '',
      };
    }
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

  async patchOfficialPlanContent(
    planId: number,
    content: {
      target_market_prof: Record<string, string>;
      strategy_framework: Record<string, string>;
    },
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_marketing_plans
       SET target_market_prof_json = $2::jsonb,
           strategy_framework_json = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        planId,
        JSON.stringify(content.target_market_prof ?? {}),
        JSON.stringify(content.strategy_framework ?? {}),
      ],
    );
  }

  async findOrCreatePresalesResearchProject(opts: {
    clientId: string;
    lifecycleId: number | null;
    title: string;
    actor: string;
  }): Promise<number> {
    const existing = await this.db.query(
      `SELECT id FROM crm_research_projects
       WHERE client_id = $1
         AND (
           ($2::int IS NOT NULL AND lifecycle_id = $2)
           OR title ILIKE '%presales%'
         )
       ORDER BY CASE WHEN lifecycle_id = $2 THEN 0 ELSE 1 END, id DESC
       LIMIT 1`,
      [opts.clientId, opts.lifecycleId],
    );
    if (existing.rows[0]?.id != null) return Number(existing.rows[0].id);

    const inserted = await this.db.query(
      `INSERT INTO crm_research_projects (
         client_id, title, product_type, dv12_tier, decision_statement,
         geo, languages, risk_class, lifecycle_id, status, created_by, updated_by
       ) VALUES (
         $1, $2, 'GTM', 'CB', $3,
         '["VN"]'::jsonb, '["vi"]'::jsonb, 'low', $4, 'intake', $5, $5
       ) RETURNING id`,
      [
        opts.clientId,
        opts.title.slice(0, 240),
        'Presales insight draft — chờ duyệt (P7)',
        opts.lifecycleId,
        opts.actor.slice(0, 120),
      ],
    );
    return Number(inserted.rows[0].id);
  }

  async createPendingInsight(opts: {
    projectId: number;
    statement: string;
    observation: string;
    interpretation: string;
    implication: string;
    recommendation: string;
    actor: string;
    confidenceJson?: Record<string, unknown>;
  }): Promise<{ id: number; status: string }> {
    const r = await this.db.query(
      `INSERT INTO crm_research_insights (
         project_id, statement, observation, interpretation, implication, recommendation,
         audience, status, confidence_rationale, confidence_json, created_by, ai_generated
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         'internal', 'draft', $7, $8::jsonb, $9, TRUE
       ) RETURNING id, status`,
      [
        opts.projectId,
        opts.statement.slice(0, 4000),
        opts.observation.slice(0, 4000) || null,
        opts.interpretation.slice(0, 4000) || null,
        opts.implication.slice(0, 4000) || null,
        opts.recommendation.slice(0, 4000) || null,
        'P7 insight.draft_from_presales — pending human review',
        JSON.stringify(opts.confidenceJson ?? { origin: 'presales_ai', source_tool: 'insight.draft_from_presales' }),
        opts.actor.slice(0, 120),
      ],
    );
    return { id: Number(r.rows[0].id), status: String(r.rows[0].status) };
  }

  async getInsightById(
    insightId: number,
  ): Promise<{
    id: number;
    project_id: number;
    status: string;
    ai_generated: boolean;
    statement: string;
    confidence_rationale: string | null;
    confidence_json: unknown;
    evidence_ids: number[];
  } | null> {
    try {
      const r = await this.db.query(
        `SELECT i.id, i.project_id, i.status,
                COALESCE(i.ai_generated, false) AS ai_generated,
                i.statement, i.confidence_rationale, i.confidence_json,
                COALESCE((
                  SELECT json_agg(ie.evidence_id ORDER BY ie.evidence_id)
                  FROM crm_research_insight_evidence ie
                  WHERE ie.insight_id = i.id
                ), '[]'::json) AS evidence_ids
         FROM crm_research_insights i
         WHERE i.id = $1
         LIMIT 1`,
        [insightId],
      );
      const row = r.rows[0];
      if (!row) return null;
      const evidenceRaw = row.evidence_ids;
      const evidenceIds = Array.isArray(evidenceRaw)
        ? evidenceRaw.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        : [];
      return {
        id: Number(row.id),
        project_id: Number(row.project_id),
        status: String(row.status ?? ''),
        ai_generated: Boolean(row.ai_generated),
        statement: String(row.statement ?? ''),
        confidence_rationale: row.confidence_rationale != null ? String(row.confidence_rationale) : null,
        confidence_json:
          typeof row.confidence_json === 'string'
            ? JSON.parse(row.confidence_json)
            : row.confidence_json ?? null,
        evidence_ids: evidenceIds,
      };
    } catch {
      return null;
    }
  }

  async countApprovedInsights(projectId: number): Promise<number> {
    try {
      const r = await this.db.query(
        `SELECT COUNT(*)::int AS n
         FROM crm_research_insights
         WHERE project_id = $1
           AND status = ANY($2::text[])`,
        [projectId, ['approved_internal', 'approved_client_facing', 'published']],
      );
      return Number(r.rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }

  async patchInsightConfidence(opts: {
    insightId: number;
    confidenceJson: Record<string, unknown>;
    rationale?: string;
  }): Promise<void> {
    const rationale =
      opts.rationale ?? 'P8.3 approved_internal — presales_auto_seed rubric';
    await this.db.query(
      `UPDATE crm_research_insights
       SET confidence_json = $2::jsonb,
           confidence_rationale = $3,
           ai_generated = TRUE,
           updated_at = NOW()
       WHERE id = $1`,
      [opts.insightId, JSON.stringify(opts.confidenceJson), rationale.slice(0, 4000)],
    );
  }

  async seedPresalesEvidenceAndRubric(opts: {
    insightId: number;
    projectId: number;
    actor: string;
    excerpt: string;
    confidenceJson: Record<string, unknown>;
  }): Promise<number[]> {
    const source = await this.db.query(
      `INSERT INTO crm_research_sources (
         project_id, question_id, source_type, title, publisher, url,
         published_at, accessed_at, geo, license_note, reliability_tier, limitation_note,
         ai_generated, keep
       ) VALUES (
         $1, NULL, 'internal', $2, 'PTT Presales', NULL,
         NULL, NOW()::date, NULL, NULL, 'primary', 'Auto-seeded from BANT/TMMT/contract cites (P8.3)',
         TRUE, TRUE
       ) RETURNING id`,
      [opts.projectId, `Presales pack — Insight #${opts.insightId}`.slice(0, 240)],
    );
    const sourceId = Number(source.rows[0].id);
    const ev = await this.db.query(
      `INSERT INTO crm_research_evidence (
         project_id, source_id, study_id, question_id, locator, excerpt,
         value_num, unit, value_base, period_note, geography, pii_class, created_by,
         qc_status, checksum
       ) VALUES (
         $1, $2, NULL, NULL, $3, $4,
         NULL, NULL, NULL, NULL, NULL, 'none', $5,
         'verified', $6
       ) RETURNING id`,
      [
        opts.projectId,
        sourceId,
        `presales_pack:insight:${opts.insightId}`,
        opts.excerpt.slice(0, 800),
        opts.actor.slice(0, 120),
        `presales-seed-${opts.insightId}-${Date.now()}`,
      ],
    );
    const evidenceId = Number(ev.rows[0].id);
    await this.db.query(
      `INSERT INTO crm_research_insight_evidence (insight_id, evidence_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [opts.insightId, evidenceId],
    );
    await this.patchInsightConfidence({
      insightId: opts.insightId,
      confidenceJson: opts.confidenceJson,
      rationale: 'P8.3 approved_internal — assumed_from_presales rubric + verified evidence',
    });
    return [evidenceId];
  }

  async backfillPresalesInsightOrigin(opts: {
    insightId: number;
    projectId?: number;
    lifecycleId?: number;
  }): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE crm_research_insights
       SET ai_generated = TRUE,
           confidence_json = COALESCE(confidence_json, '{}'::jsonb)
             || $2::jsonb,
           confidence_rationale = COALESCE(
             NULLIF(trim(confidence_rationale), ''),
             'P7 insight.draft_from_presales — pending human review'
           ),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [
        opts.insightId,
        JSON.stringify({
          origin: 'presales_ai',
          source_tool: 'insight.draft_from_presales',
          ai_draft: { presales: true },
          ...(opts.lifecycleId ? { lifecycle_id: opts.lifecycleId } : {}),
          ...(opts.projectId ? { research_id: opts.projectId } : {}),
        }),
      ],
    );
    return Boolean(r.rows[0]);
  }

  async approveAiInsightInternal(opts: {
    insightId: number;
    projectId: number;
    reviewer: string;
    comments: string;
  }): Promise<{ id: number; project_id: number; status: string } | null> {
    const updated = await this.db.query(
      `UPDATE crm_research_insights
       SET status = 'approved_internal',
           confidence_rationale = CASE
             WHEN confidence_rationale ILIKE '%pending%'
               OR confidence_rationale ILIKE '%pending_review%'
               OR confidence_rationale ILIKE '%pending human%'
             THEN 'P8.3 approved_internal — presales_auto_seed'
             ELSE COALESCE(
               NULLIF(trim(confidence_rationale), ''),
               'P8.3 approved_internal — presales_auto_seed'
             )
           END,
           updated_at = NOW()
       WHERE id = $1
         AND status = ANY($2::text[])
       RETURNING id, project_id, status`,
      [
        opts.insightId,
        ['draft', 'evidence_attached', 'analyst_verified', 'peer_reviewed'],
      ],
    );
    const row = updated.rows[0];
    if (!row) return null;
    try {
      await this.db.query(
        `INSERT INTO crm_research_reviews (
           project_id, object_type, object_id, reviewer, role, decision, comments, decided_at
         ) VALUES ($1, 'insight', $2, $3, 'approver', 'approve', $4, NOW())`,
        [opts.projectId, opts.insightId, opts.reviewer.slice(0, 120), opts.comments.slice(0, 500)],
      );
    } catch {
      // review table optional for gate count
    }
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      status: String(row.status),
    };
  }

  async insertPlanReview(input: {
    name: string;
    period_label: string;
    objectives: string;
    notes: string;
    lifecycle_id: number | null;
    strategy_framework_json: Record<string, unknown>;
    target_market_prof_json: Record<string, unknown>;
    north_star?: string;
  }): Promise<number> {
    const code = `AI-REVIEW-${Date.now()}`;
    const r = await this.db.query(
      `INSERT INTO crm_marketing_plans (
         code, name, status, plan_kind, lifecycle_id, period_label, objectives, notes,
         north_star, strategy_framework_json, target_market_prof_json, target_market_steps4_json,
         created_at, updated_at
       ) VALUES (
         $1, $2, 'review', 'standalone', $3, $4, $5, $6,
         $7, $8::jsonb, $9::jsonb, '{}'::jsonb, NOW(), NOW()
       ) RETURNING id`,
      [
        code,
        String(input.name ?? '').slice(0, 400),
        input.lifecycle_id,
        String(input.period_label ?? '').slice(0, 120),
        String(input.objectives ?? '').slice(0, 32000),
        String(input.notes ?? '').slice(0, 32000),
        String(input.north_star ?? '').slice(0, 2000),
        JSON.stringify(input.strategy_framework_json ?? {}),
        JSON.stringify(input.target_market_prof_json ?? {}),
      ],
    );
    return Number(r.rows[0].id);
  }

  async getPlanStatus(planId: number): Promise<string | null> {
    const r = await this.db.query(`SELECT status FROM crm_marketing_plans WHERE id = $1 LIMIT 1`, [
      planId,
    ]);
    return r.rows[0]?.status != null ? String(r.rows[0].status) : null;
  }

  async staffName(staffId: number | null): Promise<string> {
    if (staffId == null) return '';
    try {
      const r = await this.db.query(
        `SELECT COALESCE(name, email, '') AS name FROM crm_staff WHERE id = $1 LIMIT 1`,
        [staffId],
      );
      return String(r.rows[0]?.name ?? '').trim();
    } catch {
      try {
        const r = await this.db.query(
          `SELECT COALESCE(name, '') AS name FROM staff WHERE id = $1 LIMIT 1`,
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

  async getStageTask(
    lifecycleId: number,
    stage: string,
  ): Promise<{ id: number; form_data: Record<string, unknown>; notes: string; is_done: boolean } | null> {
    const r = await this.db.query(
      `SELECT id, form_data, COALESCE(notes, '') AS notes, COALESCE(is_done, false) AS is_done
       FROM crm_svc_tasks
       WHERE lifecycle_id = $1 AND stage = $2
       ORDER BY step_index ASC NULLS LAST, id ASC
       LIMIT 1`,
      [lifecycleId, stage],
    );
    const row = r.rows[0];
    if (!row) return null;
    const form =
      row.form_data && typeof row.form_data === 'object'
        ? (row.form_data as Record<string, unknown>)
        : {};
    return {
      id: Number(row.id),
      form_data: form,
      notes: String(row.notes ?? ''),
      is_done: Boolean(row.is_done),
    };
  }

  /** Create Consult (or Lead) svc task when missing so P8 drafts can persist. */
  async ensureStageTask(
    lifecycleId: number,
    stage: 'consult' | 'lead',
    title?: string,
  ): Promise<{ id: number; form_data: Record<string, unknown>; notes: string; is_done: boolean }> {
    const existing = await this.getStageTask(lifecycleId, stage);
    if (existing) return existing;
    const defaultTitle =
      title ||
      (stage === 'consult'
        ? 'Consult — Pain/ICP assumed draft (P8)'
        : 'Lead — Qualify / Pain seed (P8)');
    const formFields =
      stage === 'consult'
        ? [
            { key: 'current_status', label: 'Need / Pain', type: 'textarea' },
            { key: 'target_audience', label: 'Đối tượng mục tiêu', type: 'textarea' },
          ]
        : [{ key: 'need', label: 'Need / Pain', type: 'textarea' }];
    const r = await this.db.query(
      `INSERT INTO crm_svc_tasks
         (lifecycle_id, stage, step_index, title, description, form_fields, form_data,
          ai_prompt_key, ai_output, is_done, notes, is_custom, created_at, updated_at)
       VALUES (
         $1, $2, 0, $3, $4, $5::jsonb, '{}'::jsonb,
         '', '', FALSE, '', TRUE, NOW(), NOW()
       )
       RETURNING id, form_data, COALESCE(notes, '') AS notes, COALESCE(is_done, false) AS is_done`,
      [
        lifecycleId,
        stage,
        defaultTitle.slice(0, 400),
        'Auto-created by P8 consult.draft_from_research / confirm so drafts persist.',
        JSON.stringify(formFields),
      ],
    );
    const row = r.rows[0];
    return {
      id: Number(row.id),
      form_data:
        row.form_data && typeof row.form_data === 'object'
          ? (row.form_data as Record<string, unknown>)
          : {},
      notes: String(row.notes ?? ''),
      is_done: Boolean(row.is_done),
    };
  }

  async patchStageTaskFormData(
    taskId: number,
    formData: Record<string, unknown>,
    notes?: string,
  ): Promise<void> {
    if (notes != null) {
      await this.db.query(
        `UPDATE crm_svc_tasks
         SET form_data = $2::jsonb, notes = $3, updated_at = NOW()
         WHERE id = $1`,
        [taskId, JSON.stringify(formData), notes.slice(0, 4000)],
      );
      return;
    }
    await this.db.query(
      `UPDATE crm_svc_tasks
       SET form_data = $2::jsonb, updated_at = NOW()
       WHERE id = $1`,
      [taskId, JSON.stringify(formData)],
    );
  }

  async patchLifecycleServiceSlug(lifecycleId: number, serviceSlug: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_service_lifecycle
       SET service_slug = $2, updated_at = NOW()
       WHERE id = $1`,
      [lifecycleId, serviceSlug.slice(0, 80)],
    );
  }

  async patchIntakeAnswersMeta(
    sessionId: number,
    metaPatch: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_lead_intake_sessions
       SET answers_json = jsonb_set(
         COALESCE(answers_json, '{}'::jsonb),
         '{meta}',
         COALESCE(answers_json->'meta', '{}'::jsonb) || $2::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [sessionId, JSON.stringify(metaPatch)],
    );
  }

  async createProposalDraft(opts: {
    leadId: number | null;
    lifecycleId: number | null;
    title: string;
    notes: string;
    serviceSlug: string;
    aiOutput: Record<string, unknown>;
  }): Promise<number> {
    const ts = new Date().toISOString();
    const notes = [
      opts.title ? `[P8 draft] ${opts.title}` : '[P8 draft]',
      opts.notes,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000);
    const r = await this.db.query(
      `INSERT INTO crm_proposals (
         customer_id, lead_id, lifecycle_id, service_slugs, total_vnd,
         timeline_months, notes, ai_output, status, price_adjustment_reason,
         created_at, updated_at
       ) VALUES (
         NULL, $1, $2, $3, 0, 1, $4, $5::jsonb, 'draft', '', $6, $6
       ) RETURNING id`,
      [
        opts.leadId,
        opts.lifecycleId,
        JSON.stringify(opts.serviceSlug ? [opts.serviceSlug] : []),
        notes,
        JSON.stringify(opts.aiOutput ?? {}),
        ts,
      ],
    );
    return Number(r.rows[0].id);
  }
}
