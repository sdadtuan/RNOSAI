import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CMKT_REVIEW_SLA_HOURS } from '../content-marketing/content-marketing.constants';
import {
  emptyPortfolioCommandCenter,
  PORTFOLIO_SLA_AT_RISK_HOURS,
  type ContentRequestRow,
  type ContentRequestWrite,
  type ItemRequestLinkPatch,
  type PortfolioCommandCenter,
  type PortfolioProductionItem,
  type PortfolioRiskQueueItem,
} from './content-os-portfolio.types';
import type { AiTraceJobRecord } from './ai-traces.util';
import {
  CMKT_INSIGHT_STATUSES,
  type CmktInsightRow,
  type CmktInsightStatus,
} from './copilot-insights.util';
import { nextDisplaySeq } from './display-seq';
import { formatContentItemCode, formatContentRequestCode } from './content-os-portfolio.util';

function isOptionalAiRunJoinError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code ?? '');
  if (code !== '42P01' && code !== '42703') return false;
  const message = err instanceof Error ? err.message : String((err as { message?: unknown }).message ?? '');
  const table = String((err as { table?: unknown }).table ?? '');
  const column = String((err as { column?: unknown }).column ?? '');
  const haystack = `${message} ${table} ${column}`;
  return /\bai_agent_runs\b|\bai_run_id\b/i.test(haystack);
}

@Injectable()
export class ContentOsPortfolioRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM cmkt_content_items LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  async listScopedLifecycleIds(staffId: number): Promise<number[]> {
    if (!(staffId > 0)) return [];
    if (!(await this.ensurePgReady())) return [];
    try {
      const params: unknown[] = [];
      const conditions = [`status IN ('active', 'draft')`];
      if (staffId > 0) {
        params.push(staffId);
        conditions.push(`(assigned_am = $${params.length} OR assigned_sp = $${params.length})`);
      }
      const res = await this.db.query(
        `SELECT id FROM crm_service_lifecycle
         WHERE ${conditions.join(' AND ')}
         ORDER BY id ASC`,
        params,
      );
      return res.rows.map((row) => Number(row.id));
    } catch {
      return [];
    }
  }

  async aggregateCommand(lifecycleIds: number[]): Promise<PortfolioCommandCenter> {
    const empty = emptyPortfolioCommandCenter();
    if (!lifecycleIds.length) return empty;
    if (!(await this.ensurePgReady())) return empty;
    try {
      const countsRes = await this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::int AS throughput_week,
           COUNT(*) FILTER (
             WHERE status = 'published'
               AND published_at IS NOT NULL
               AND published_at >= NOW() - INTERVAL '7 days'
           )::int AS completed_week,
           COUNT(*) FILTER (WHERE status NOT IN ('published', 'archived'))::int AS wip,
           COUNT(*) FILTER (
             WHERE status IN ('in_review', 'changes_requested')
               AND in_review_at IS NOT NULL
               AND in_review_at < NOW() - ($2::int * INTERVAL '1 hour')
           )::int AS sla_at_risk,
           COUNT(*) FILTER (
             WHERE status IN ('in_review', 'changes_requested')
               AND in_review_at IS NOT NULL
               AND in_review_at < NOW() - ($3::int * INTERVAL '1 hour')
           )::int AS sla_breached,
           COUNT(*) FILTER (
             WHERE status = 'changes_requested'
                OR production_json->>'escalate_human' = 'true'
           )::int AS blocked
         FROM cmkt_content_items
         WHERE lifecycle_id = ANY($1::bigint[])`,
        [lifecycleIds, PORTFOLIO_SLA_AT_RISK_HOURS, CMKT_REVIEW_SLA_HOURS],
      );
      const row = countsRes.rows[0] ?? {};
      const risk_queue = await this.listRiskQueue(lifecycleIds);
      return {
        throughput_week: Number(row.throughput_week ?? 0),
        completed_week: Number(row.completed_week ?? 0),
        wip: Number(row.wip ?? 0),
        sla_at_risk: Number(row.sla_at_risk ?? 0),
        sla_breached: Number(row.sla_breached ?? 0),
        first_pass_pct: null,
        capacity_pct: null,
        blocked: Number(row.blocked ?? 0),
        risk_queue,
      };
    } catch {
      return empty;
    }
  }

  async listScopedProductionItems(lifecycleIds: number[]): Promise<PortfolioProductionItem[]> {
    if (!lifecycleIds.length) return [];
    if (!(await this.ensurePgReady())) return [];
    const res = await this.db.query(
      `SELECT id, lifecycle_id, title, assignee_sp, production_json
         FROM cmkt_content_items
         WHERE lifecycle_id = ANY($1::bigint[])
         ORDER BY id ASC`,
      [lifecycleIds],
    );
    return res.rows.map((row) => ({
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      title: String(row.title ?? ''),
      assignee_sp: row.assignee_sp != null ? Number(row.assignee_sp) : null,
      production_json: (row.production_json as PortfolioProductionItem['production_json']) ?? {},
    }));
  }

  private async listRiskQueue(lifecycleIds: number[]): Promise<PortfolioRiskQueueItem[]> {
    const res = await this.db.query(
      `SELECT
         i.id AS item_id,
         i.lifecycle_id,
         i.title,
         i.status,
         i.in_review_at,
         i.production_json->>'escalate_human' AS escalate_human,
         CASE
           WHEN i.status IN ('in_review', 'changes_requested') AND i.in_review_at IS NOT NULL
           THEN $3::int - EXTRACT(EPOCH FROM (NOW() - i.in_review_at)) / 3600.0
           ELSE NULL
         END AS sla_remaining_h
       FROM cmkt_content_items i
       WHERE i.lifecycle_id = ANY($1::bigint[])
         AND (
           (
             i.status IN ('in_review', 'changes_requested')
             AND i.in_review_at IS NOT NULL
             AND i.in_review_at < NOW() - ($2::int * INTERVAL '1 hour')
           )
           OR i.status = 'changes_requested'
           OR i.production_json->>'escalate_human' = 'true'
         )
       ORDER BY i.in_review_at ASC NULLS LAST, i.id ASC
       LIMIT 50`,
      [lifecycleIds, PORTFOLIO_SLA_AT_RISK_HOURS, CMKT_REVIEW_SLA_HOURS],
    );
    return res.rows.map((row) => this.mapRiskRow(row as Record<string, unknown>));
  }

  private mapRiskRow(row: Record<string, unknown>): PortfolioRiskQueueItem {
    const status = String(row.status ?? '');
    const escalate = String(row.escalate_human ?? '') === 'true';
    const remaining =
      row.sla_remaining_h != null && Number.isFinite(Number(row.sla_remaining_h))
        ? Math.round(Number(row.sla_remaining_h) * 10) / 10
        : null;
    const blocked = status === 'changes_requested' || escalate;
    const slaBreached = remaining != null && remaining < 0;

    let risk_signal = 'SLA_AT_RISK';
    let recommended_action = 'Ưu tiên duyệt trước khi quá SLA';
    if (slaBreached) {
      risk_signal = 'SLA_BREACHED';
      recommended_action = 'Escalate SLA đã quá hạn';
    } else if (blocked) {
      risk_signal = 'BLOCKED';
      recommended_action = 'Gỡ block / escalate production';
    }

    return {
      item_id: Number(row.item_id),
      lifecycle_id: Number(row.lifecycle_id),
      content_code: null,
      title: String(row.title ?? ''),
      client_label: null,
      risk_signal,
      owner_label: null,
      sla_remaining_h: remaining,
      recommended_action,
    };
  }

  async nextRequestSeq(now = new Date()): Promise<number> {
    return this.nextDisplaySeq(formatContentRequestCode(now, 0));
  }

  async nextItemSeq(now = new Date()): Promise<number> {
    return this.nextDisplaySeq(formatContentItemCode(now, 0), 'cmkt_content_items');
  }

  async listRequests(lifecycleIds: number[]): Promise<ContentRequestRow[]> {
    if (!lifecycleIds.length) return [];
    if (!(await this.ensurePgReady())) return [];
    try {
      const res = await this.db.query(
        `SELECT * FROM cmkt_content_requests
         WHERE lifecycle_id = ANY($1::bigint[])
         ORDER BY created_at DESC NULLS LAST, id DESC`,
        [lifecycleIds],
      );
      return res.rows.map((row) => this.mapRequestRow(row as Record<string, unknown>));
    } catch {
      return [];
    }
  }

  async insertRequest(row: ContentRequestWrite): Promise<ContentRequestRow> {
    const res = await this.db.query(
      `INSERT INTO cmkt_content_requests (
         lifecycle_id, display_code, source, requester_email, client_label, brand_label,
         deliverable_ask, objective, due_at, priority, completeness, triage_status, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        row.lifecycle_id,
        row.display_code,
        row.source,
        row.requester_email,
        row.client_label,
        row.brand_label,
        row.deliverable_ask,
        row.objective,
        row.due_at,
        row.priority,
        row.completeness,
        row.triage_status,
        row.created_by,
      ],
    );
    return this.mapRequestRow(res.rows[0] as Record<string, unknown>);
  }

  async getRequestById(id: number): Promise<ContentRequestRow | null> {
    const res = await this.db.query(`SELECT * FROM cmkt_content_requests WHERE id = $1`, [id]);
    const row = res.rows[0];
    return row ? this.mapRequestRow(row as Record<string, unknown>) : null;
  }

  async updateRequestStatus(id: number, triageStatus: string): Promise<ContentRequestRow> {
    const res = await this.db.query(
      `UPDATE cmkt_content_requests
       SET triage_status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, triageStatus],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error(`content_request_not_found:${id}`);
    }
    return this.mapRequestRow(row as Record<string, unknown>);
  }

  async updateItemRequestLink(itemId: number, patch: ItemRequestLinkPatch): Promise<ItemRequestLinkPatch & { id: number }> {
    const res =
      patch.display_code != null && patch.display_code !== ''
        ? await this.db.query(
            `UPDATE cmkt_content_items
             SET request_id = $2, display_code = $3, updated_at = NOW()
             WHERE id = $1
             RETURNING id, request_id, display_code`,
            [itemId, patch.request_id, patch.display_code],
          )
        : await this.db.query(
            `UPDATE cmkt_content_items
             SET request_id = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING id, request_id, display_code`,
            [itemId, patch.request_id],
          );
    const row = res.rows[0] as { id?: unknown; request_id?: unknown; display_code?: unknown } | undefined;
    if (!row) {
      throw new Error(`content_item_not_found:${itemId}`);
    }
    return {
      id: Number(row.id),
      request_id: Number(row.request_id),
      display_code: String(row.display_code ?? ''),
    };
  }

  private async nextDisplaySeq(zeroCode: string, table: 'cmkt_content_requests' | 'cmkt_content_items' = 'cmkt_content_requests'): Promise<number> {
    return nextDisplaySeq((sql, values) => this.db.query(sql, values), zeroCode, table);
  }

  async listAiTraceJobs(itemId: number): Promise<AiTraceJobRecord[]> {
    if (!(itemId > 0)) return [];
    if (!(await this.ensurePgReady())) return [];
    const withJoin = `
         SELECT j.id, j.job_type, j.status, j.created_at, j.finished_at, j.ai_run_id::text AS ai_run_id,
                j.input_json, r.id::text AS run_id, r.input_json AS run_input_json,
                r.created_at AS run_created_at, r.ended_at AS run_ended_at
         FROM cmkt_content_jobs j
         LEFT JOIN ai_agent_runs r ON r.id = j.ai_run_id
         WHERE j.item_id = $1
         ORDER BY COALESCE(j.finished_at, j.created_at) DESC NULLS LAST, j.id DESC`;
    const jobsOnly = `
         SELECT id, job_type, status, created_at, finished_at, input_json
         FROM cmkt_content_jobs
         WHERE item_id = $1
         ORDER BY COALESCE(finished_at, created_at) DESC NULLS LAST, id DESC`;
    let rows: Record<string, unknown>[];
    let skipRun = false;
    try {
      const res = await this.db.query(withJoin, [itemId]);
      rows = res.rows as Record<string, unknown>[];
    } catch (err) {
      if (!isOptionalAiRunJoinError(err)) throw err;
      const res = await this.db.query(jobsOnly, [itemId]);
      rows = res.rows as Record<string, unknown>[];
      skipRun = true;
    }
    return rows.map((row) => this.mapAiTraceJobRow(row, { skipRun }));
  }

  async listInsights(
    lifecycleIds: number[],
    statuses: CmktInsightStatus[] = ['Draft', 'Approved'],
  ): Promise<CmktInsightRow[]> {
    if (!lifecycleIds.length) return [];
    if (!(await this.ensurePgReady())) return [];
    try {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at, created_at
         FROM cmkt_insights
         WHERE lifecycle_id = ANY($1::bigint[])
           AND status = ANY($2::text[])
         ORDER BY created_at DESC NULLS LAST, id DESC`,
        [lifecycleIds, statuses],
      );
      return res.rows.map((row) => this.mapInsightRow(row as Record<string, unknown>));
    } catch {
      return [];
    }
  }

  async listInsightsForLifecycle(lifecycleId: number): Promise<CmktInsightRow[]> {
    if (!(lifecycleId > 0)) return [];
    if (!(await this.ensurePgReady())) return [];
    try {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at, created_at
         FROM cmkt_insights
         WHERE lifecycle_id = $1
         ORDER BY id ASC`,
        [lifecycleId],
      );
      return res.rows.map((row) => this.mapInsightRow(row as Record<string, unknown>));
    } catch {
      return [];
    }
  }

  async getInsightById(id: number): Promise<CmktInsightRow | null> {
    if (!(await this.ensurePgReady())) return null;
    const res = await this.db.query(
      `SELECT id, lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at, created_at
       FROM cmkt_insights
       WHERE id = $1`,
      [id],
    );
    const row = res.rows[0];
    return row ? this.mapInsightRow(row as Record<string, unknown>) : null;
  }

  async insertInsight(row: {
    lifecycle_id: number;
    pattern: string;
    evidence?: string;
    confidence?: number | null;
    status?: CmktInsightStatus;
    scope_json?: Record<string, unknown>;
    expires_at?: string | null;
  }): Promise<CmktInsightRow> {
    const res = await this.db.query(
      `INSERT INTO cmkt_insights (lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id, lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at, created_at`,
      [
        row.lifecycle_id,
        row.pattern,
        row.evidence ?? '',
        row.confidence ?? null,
        row.status ?? 'Draft',
        JSON.stringify(row.scope_json ?? {}),
        row.expires_at ?? null,
      ],
    );
    return this.mapInsightRow(res.rows[0] as Record<string, unknown>);
  }

  async updateInsightStatus(id: number, status: CmktInsightStatus): Promise<CmktInsightRow> {
    const res = await this.db.query(
      `UPDATE cmkt_insights
       SET status = $2
       WHERE id = $1 AND status = 'Draft'
       RETURNING id, lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at, created_at`,
      [id, status],
    );
    const row = res.rows[0];
    if (!row) {
      const existing = await this.getInsightById(id);
      if (!existing) {
        throw new Error(`insight_not_found:${id}`);
      }
      throw new Error(`insight_not_draft:${id}:${existing.status}`);
    }
    return this.mapInsightRow(row as Record<string, unknown>);
  }

  private mapAiTraceJobRow(
    row: Record<string, unknown>,
    opts: { skipRun?: boolean } = {},
  ): AiTraceJobRecord {
    const createdAt = row.created_at != null ? new Date(String(row.created_at)).toISOString() : '';
    const finishedAt = row.finished_at ? new Date(String(row.finished_at)).toISOString() : null;
    const mapped: AiTraceJobRecord = {
      id: Number(row.id),
      job_type: String(row.job_type ?? ''),
      status: String(row.status ?? ''),
      created_at: createdAt,
      finished_at: finishedAt,
      ai_run_id: opts.skipRun ? null : row.ai_run_id != null ? String(row.ai_run_id) : null,
      input_json:
        row.input_json && typeof row.input_json === 'object' && !Array.isArray(row.input_json)
          ? (row.input_json as Record<string, unknown>)
          : {},
    };
    if (!opts.skipRun && row.run_id != null) {
      mapped.run = {
        id: String(row.run_id),
        input_json:
          row.run_input_json && typeof row.run_input_json === 'object' && !Array.isArray(row.run_input_json)
            ? (row.run_input_json as Record<string, unknown>)
            : {},
        created_at: row.run_created_at != null ? String(row.run_created_at) : null,
        ended_at: row.run_ended_at != null ? String(row.run_ended_at) : null,
      };
    }
    return mapped;
  }

  private mapInsightRow(row: Record<string, unknown>): CmktInsightRow {
    const statusRaw = String(row.status ?? 'Draft');
    const status = (CMKT_INSIGHT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as CmktInsightStatus)
      : 'Draft';
    const scope = row.scope_json;
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      pattern: String(row.pattern ?? ''),
      evidence: String(row.evidence ?? ''),
      confidence: row.confidence != null ? Number(row.confidence) : null,
      status,
      scope_json:
        scope && typeof scope === 'object' && !Array.isArray(scope)
          ? (scope as Record<string, unknown>)
          : {},
      expires_at: row.expires_at != null ? String(row.expires_at) : null,
      created_at: String(row.created_at ?? ''),
    };
  }

  private mapRequestRow(row: Record<string, unknown>): ContentRequestRow {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      display_code: String(row.display_code ?? ''),
      kind: 'request',
      source: String(row.source ?? ''),
      requester_email: String(row.requester_email ?? ''),
      client_label: String(row.client_label ?? ''),
      brand_label: String(row.brand_label ?? ''),
      deliverable_ask: String(row.deliverable_ask ?? ''),
      objective: String(row.objective ?? ''),
      due_at: row.due_at != null ? String(row.due_at) : null,
      priority: String(row.priority ?? 'Standard'),
      risk_level: String(row.risk_level ?? 'Normal'),
      completeness: Number(row.completeness ?? 0),
      effort_h: row.effort_h != null ? Number(row.effort_h) : null,
      tier: row.tier != null ? String(row.tier) : null,
      triage_status: String(row.triage_status ?? 'Submitted'),
      idea_id: row.idea_id != null ? Number(row.idea_id) : null,
      created_by: String(row.created_by ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }
}
