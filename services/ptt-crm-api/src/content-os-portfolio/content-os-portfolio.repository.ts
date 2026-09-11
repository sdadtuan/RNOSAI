import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
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
import {
  CMKT_GLOSSARY_STATUSES,
  isMissingGlossarySchema,
  type CmktGlossaryRow,
  type CmktGlossaryStatus,
} from './copilot-glossary.util';
import { nextDisplaySeq } from './display-seq';
import { formatContentItemCode, formatContentRequestCode } from './content-os-portfolio.util';
import {
  AUDIT_EXPORT_ACTION,
  AUDIT_EXPORT_ENTITY,
  HARD_DELETE_ACTION,
  isMissingAuditExportSchema,
  type AuditExportRow,
} from './audit-export.util';
import type { HardDeleteOutcome } from './legal-hold.util';
import { isMissingCmktSettingsSchema, type CmktSettingRow } from './direct-social-publish.util';
import { isPgUniqueViolation } from './publication-execute.util';

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
    const res = await this.db.query(
      `SELECT id, lifecycle_id, pattern, evidence, confidence, status, scope_json, expires_at, created_at
         FROM cmkt_insights
         WHERE lifecycle_id = ANY($1::bigint[])
           AND status = ANY($2::text[])
         ORDER BY created_at DESC NULLS LAST, id DESC`,
      [lifecycleIds, statuses],
    );
    return res.rows.map((row) => this.mapInsightRow(row as Record<string, unknown>));
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

  async listGlossary(
    lifecycleIds: number[],
    statuses: CmktGlossaryStatus[] = ['Draft', 'Approved'],
  ): Promise<CmktGlossaryRow[]> {
    if (!lifecycleIds.length) return [];
    if (!(await this.ensurePgReady())) return [];
    try {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, brand_id, term, locale, preferred, status, expires_at, created_at
           FROM cmkt_glossary
           WHERE lifecycle_id = ANY($1::bigint[])
             AND status = ANY($2::text[])
           ORDER BY created_at DESC NULLS LAST, id DESC`,
        [lifecycleIds, statuses],
      );
      return res.rows.map((row) => this.mapGlossaryRow(row as Record<string, unknown>));
    } catch (err) {
      if (isMissingGlossarySchema(err)) return [];
      throw err;
    }
  }

  async listGlossaryForLifecycle(lifecycleId: number): Promise<CmktGlossaryRow[]> {
    if (!(lifecycleId > 0)) return [];
    if (!(await this.ensurePgReady())) return [];
    try {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, brand_id, term, locale, preferred, status, expires_at, created_at
         FROM cmkt_glossary
         WHERE lifecycle_id = $1
         ORDER BY id ASC`,
        [lifecycleId],
      );
      return res.rows.map((row) => this.mapGlossaryRow(row as Record<string, unknown>));
    } catch {
      return [];
    }
  }

  async getGlossaryById(id: number): Promise<CmktGlossaryRow | null> {
    if (!(await this.ensurePgReady())) return null;
    const res = await this.db.query(
      `SELECT id, lifecycle_id, brand_id, term, locale, preferred, status, expires_at, created_at
       FROM cmkt_glossary
       WHERE id = $1`,
      [id],
    );
    const row = res.rows[0];
    return row ? this.mapGlossaryRow(row as Record<string, unknown>) : null;
  }

  async updateGlossaryStatus(id: number, status: CmktGlossaryStatus): Promise<CmktGlossaryRow> {
    const res = await this.db.query(
      `UPDATE cmkt_glossary
       SET status = $2
       WHERE id = $1 AND status = 'Draft'
       RETURNING id, lifecycle_id, brand_id, term, locale, preferred, status, expires_at, created_at`,
      [id, status],
    );
    const row = res.rows[0];
    if (!row) {
      const existing = await this.getGlossaryById(id);
      if (!existing) {
        throw new Error(`glossary_not_found:${id}`);
      }
      throw new Error(`glossary_not_draft:${id}:${existing.status}`);
    }
    return this.mapGlossaryRow(row as Record<string, unknown>);
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

  async getSetting(key: string): Promise<CmktSettingRow | null> {
    if (!(await this.ensurePgReady())) {
      throw new ServiceUnavailableException({ error: 'postgres_not_ready' });
    }
    try {
      const res = await this.db.query(
        `SELECT key, value_json FROM cmkt_settings WHERE key = $1 LIMIT 1`,
        [key],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return { key: String(row.key ?? key), value_json: row.value_json };
    } catch (err) {
      if (isMissingCmktSettingsSchema(err)) return null;
      throw err;
    }
  }

  async insertAuditExport(input: {
    actor: string;
    action?: string;
    entity?: string;
  }): Promise<AuditExportRow> {
    const action = input.action || AUDIT_EXPORT_ACTION;
    const entity = input.entity || AUDIT_EXPORT_ENTITY;
    const res = await this.db.query(
      `INSERT INTO cmkt_audit_exports (actor, action, entity)
       VALUES ($1, $2, $3)
       RETURNING actor, action, entity, created_at`,
      [input.actor, action, entity],
    );
    return this.mapAuditExportRow(res.rows[0] as Record<string, unknown>);
  }

  async listAuditActivity(lifecycleIds: number[]): Promise<AuditExportRow[]> {
    if (!lifecycleIds.length) return [];
    if (!(await this.ensurePgReady())) {
      throw new ServiceUnavailableException({ error: 'postgres_not_ready' });
    }
    const queryActivity = async (includeExports: boolean) => {
      const exportArm = includeExports
        ? `
         UNION ALL
         SELECT e.actor,
                e.action,
                e.entity,
                e.created_at,
                NULL::int AS item_id,
                e.id
           FROM cmkt_audit_exports e`
        : '';
      return this.db.query(
        `SELECT actor, action, entity, created_at, item_id, id
       FROM (
         SELECT v.changed_by AS actor,
                v.change_reason AS action,
                'item_version' AS entity,
                v.created_at,
                v.item_id,
                v.id
           FROM cmkt_content_item_versions v
           JOIN cmkt_content_items i ON i.id = v.item_id
          WHERE i.lifecycle_id = ANY($1::int[])
         UNION ALL
         SELECT '' AS actor,
                CASE WHEN l.error IS NULL THEN 'published' ELSE 'publish_failed' END AS action,
                'publication' AS entity,
                l.attempted_at AS created_at,
                l.item_id,
                l.id
           FROM cmkt_publication_logs l
           JOIN cmkt_content_items i ON i.id = l.item_id
          WHERE i.lifecycle_id = ANY($1::int[])
         UNION ALL
         SELECT COALESCE(s.am_staff_id::text, '') AS actor,
                s.action,
                'sla_event' AS entity,
                s.created_at,
                s.item_id,
                s.id
           FROM cmkt_sla_events s
           JOIN cmkt_content_items i ON i.id = s.item_id
          WHERE i.lifecycle_id = ANY($1::int[])${exportArm}
       ) activity
       ORDER BY created_at ASC, id ASC`,
        [lifecycleIds],
      );
    };
    try {
      const res = await queryActivity(true);
      return res.rows.map((row) => this.mapAuditActivityRow(row as Record<string, unknown>));
    } catch (err) {
      if (!isMissingAuditExportSchema(err)) throw err;
      const res = await queryActivity(false);
      return res.rows.map((row) => this.mapAuditActivityRow(row as Record<string, unknown>));
    }
  }

  async hardDeleteItem(input: {
    itemId: number;
    actor: string;
    lifecycleIds: number[];
  }): Promise<HardDeleteOutcome> {
    const res = await this.db.query(
      `WITH target AS (
         SELECT id, legal_hold, lifecycle_id
           FROM cmkt_content_items
          WHERE id = $1
       ),
       deleted AS (
         DELETE FROM cmkt_content_items AS t
          USING target
          WHERE t.id = target.id
            AND target.legal_hold IS NOT TRUE
            AND target.lifecycle_id = ANY($3::int[])
         RETURNING t.id
       ),
       audited AS (
         INSERT INTO cmkt_audit_exports (actor, action, entity)
         SELECT $2, '${HARD_DELETE_ACTION}', 'item:' || deleted.id
           FROM deleted
         RETURNING id
       )
       SELECT CASE
                WHEN deleted.id IS NOT NULL THEN 'deleted'
                WHEN target.legal_hold IS TRUE THEN 'held'
                WHEN target.id IS NULL THEN 'missing'
                ELSE 'out_of_scope'
              END AS outcome,
              COALESCE(deleted.id, target.id) AS id
         FROM (SELECT 1) AS dummy
         LEFT JOIN target ON TRUE
         LEFT JOIN deleted ON TRUE`,
      [input.itemId, input.actor, input.lifecycleIds],
    );
    const outcome = String((res.rows[0] as { outcome?: unknown } | undefined)?.outcome ?? 'missing');
    if (outcome === 'deleted' || outcome === 'held' || outcome === 'out_of_scope') {
      return outcome;
    }
    return 'missing';
  }

  async upsertSetting(key: string, value: unknown, updatedBy: string): Promise<CmktSettingRow> {
    const res = await this.db.query(
      `INSERT INTO cmkt_settings (key, value_json, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (key) DO UPDATE
          SET value_json = EXCLUDED.value_json,
              updated_at = NOW(),
              updated_by = EXCLUDED.updated_by
       RETURNING key, value_json`,
      [key, JSON.stringify(value), updatedBy],
    );
    const row = res.rows[0] as Record<string, unknown>;
    return { key: String(row.key ?? key), value_json: row.value_json };
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

  private mapGlossaryRow(row: Record<string, unknown>): CmktGlossaryRow {
    const statusRaw = String(row.status ?? 'Draft');
    const status = (CMKT_GLOSSARY_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as CmktGlossaryStatus)
      : 'Draft';
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      brand_id: String(row.brand_id ?? ''),
      term: String(row.term ?? ''),
      locale: String(row.locale ?? 'vi'),
      preferred: String(row.preferred ?? ''),
      status,
      expires_at: row.expires_at != null ? String(row.expires_at) : null,
      created_at: String(row.created_at ?? ''),
    };
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

  private mapAuditExportRow(row: Record<string, unknown>): AuditExportRow {
    const createdAt = row.created_at;
    return {
      actor: String(row.actor ?? ''),
      action: String(row.action ?? AUDIT_EXPORT_ACTION),
      entity: String(row.entity ?? AUDIT_EXPORT_ENTITY),
      created_at:
        createdAt instanceof Date ? createdAt.toISOString() : new Date(String(createdAt ?? '')).toISOString(),
    };
  }

  private mapAuditActivityRow(row: Record<string, unknown>): AuditExportRow {
    const createdAt = row.created_at;
    return {
      actor: String(row.actor ?? ''),
      action: String(row.action ?? ''),
      entity: String(row.entity ?? ''),
      created_at:
        createdAt instanceof Date ? createdAt.toISOString() : new Date(String(createdAt ?? '')).toISOString(),
      item_id: row.item_id != null && row.item_id !== '' ? Number(row.item_id) : null,
      id: row.id != null && row.id !== '' ? Number(row.id) : null,
    };
  }

  async insertOauthState(input: { state: string; staffId: number; lifecycleId: number }): Promise<void> {
    await this.db.query(
      `INSERT INTO cmkt_oauth_states (state, staff_id, lifecycle_id, expires_at)
       VALUES ($1, $2, $3, NOW() + interval '10 minutes')`,
      [input.state, input.staffId, input.lifecycleId],
    );
  }

  async consumeOauthState(state: string): Promise<{ staffId: number; lifecycleId: number } | null> {
    const res = await this.db.query(
      `UPDATE cmkt_oauth_states
          SET used_at = NOW()
        WHERE state = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING staff_id, lifecycle_id`,
      [state],
    );
    const row = res.rows[0] as { staff_id?: unknown; lifecycle_id?: unknown } | undefined;
    if (!row) return null;
    return { staffId: Number(row.staff_id), lifecycleId: Number(row.lifecycle_id) };
  }

  async insertPublicationExecute(input: {
    item_id: number;
    channel_account_id: number;
    snapshot_id: string;
    client_request_id: string;
  }): Promise<{
    id: number;
    client_request_id: string;
    status: string;
    post_id?: string | null;
    replayed?: true;
  }> {
    try {
      const res = await this.db.query(
        `INSERT INTO cmkt_publication_executes
           (item_id, channel_account_id, snapshot_id, client_request_id, status)
         VALUES ($1, $2, $3, $4, 'queued')
         RETURNING id, client_request_id, status, post_id`,
        [input.item_id, input.channel_account_id, input.snapshot_id, input.client_request_id || null],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        throw new Error('publication_execute_insert_empty');
      }
      return this.mapPublicationExecuteRow(row, input.client_request_id);
    } catch (err) {
      if (!isPgUniqueViolation(err)) throw err;
      const existing =
        (input.client_request_id
          ? await this.findExecuteByClientRequestId(input.client_request_id)
          : null) ??
        (await this.findExecuteByUniqueTriple({
          item_id: input.item_id,
          channel_account_id: input.channel_account_id,
          snapshot_id: input.snapshot_id,
        }));
      if (!existing) throw err;
      return { ...existing, replayed: true };
    }
  }

  async findExecuteByClientRequestId(clientRequestId: string): Promise<{
    id: number;
    client_request_id: string;
    status: string;
    post_id: string | null;
  } | null> {
    if (!clientRequestId) return null;
    const res = await this.db.query(
      `SELECT id, client_request_id, status, post_id
         FROM cmkt_publication_executes
        WHERE client_request_id = $1
        LIMIT 1`,
      [clientRequestId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPublicationExecuteRow(row, clientRequestId) : null;
  }

  async findExecuteByUniqueTriple(input: {
    item_id: number;
    channel_account_id: number;
    snapshot_id: string;
  }): Promise<{
    id: number;
    client_request_id: string;
    status: string;
    post_id: string | null;
  } | null> {
    const res = await this.db.query(
      `SELECT id, client_request_id, status, post_id
         FROM cmkt_publication_executes
        WHERE item_id = $1 AND channel_account_id = $2 AND snapshot_id = $3
        LIMIT 1`,
      [input.item_id, input.channel_account_id, input.snapshot_id],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPublicationExecuteRow(row, '') : null;
  }

  private mapPublicationExecuteRow(
    row: Record<string, unknown>,
    fallbackClientRequestId: string,
  ): {
    id: number;
    client_request_id: string;
    status: string;
    post_id: string | null;
  } {
    return {
      id: Number(row.id),
      client_request_id: String(row.client_request_id ?? fallbackClientRequestId),
      status: String(row.status ?? 'queued'),
      post_id: row.post_id != null && String(row.post_id) !== '' ? String(row.post_id) : null,
    };
  }

  async loadConnectorSecretForExecute(executeId: number): Promise<{
    id: number;
    item_id: number;
    channel_account_id: number;
    snapshot_id: string;
    post_id: string | null;
    access_token: string | null;
    status: string | null;
    connector_status: string | null;
    page_id: string | null;
  } | null> {
    const res = await this.db.query(
      `SELECT e.id, e.item_id, e.channel_account_id, e.snapshot_id, e.post_id,
              c.access_token, c.status, a.account_ref AS page_id
         FROM cmkt_publication_executes e
         LEFT JOIN cmkt_connectors c ON c.channel_account_id = e.channel_account_id
         LEFT JOIN cmkt_channel_accounts a ON a.id = e.channel_account_id
        WHERE e.id = $1
        LIMIT 1`,
      [executeId],
    );
    const rec = res.rows[0] as Record<string, unknown> | undefined;
    if (!rec) return null;
    const status = rec.status != null ? String(rec.status) : null;
    return {
      id: Number(rec.id),
      item_id: Number(rec.item_id),
      channel_account_id: Number(rec.channel_account_id),
      snapshot_id: String(rec.snapshot_id ?? ''),
      post_id: rec.post_id != null && String(rec.post_id) !== '' ? String(rec.post_id) : null,
      access_token: rec.access_token != null ? String(rec.access_token) : null,
      status,
      connector_status: status,
      page_id: rec.page_id != null ? String(rec.page_id) : null,
    };
  }

  async updatePublicationExecuteResult(
    executeId: number,
    patch: { post_id: string; permalink: string | null; status: string },
  ): Promise<void> {
    await this.db.query(
      `UPDATE cmkt_publication_executes
          SET post_id = $2, permalink = $3, status = $4
        WHERE id = $1`,
      [executeId, patch.post_id, patch.permalink, patch.status],
    );
  }

  async markItemPublishedFromExecute(itemId: number, publishedUrl: string | null): Promise<void> {
    await this.db.query(
      `UPDATE cmkt_content_items
          SET status = 'published', published_at = NOW(), published_url = $2, updated_at = NOW()
        WHERE id = $1`,
      [itemId, publishedUrl],
    );
  }

  async saveConnectorSecrets(input: {
    lifecycleId: number;
    pageId: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date;
    channel?: string;
  }): Promise<void> {
    const channel = input.channel || 'facebook_page';
    const connectorId = `${channel}:${input.pageId}`;
    const existing = await this.db.query(
      `SELECT id FROM cmkt_channel_accounts
        WHERE channel = $1 AND account_ref = $2
        LIMIT 1`,
      [channel, input.pageId],
    );
    let accountId = existing.rows[0] ? Number((existing.rows[0] as { id?: unknown }).id) : 0;
    if (!(accountId > 0)) {
      const inserted = await this.db.query(
        `INSERT INTO cmkt_channel_accounts (lifecycle_id, channel, account_ref, display_name)
         VALUES ($1, $2, $3, $3)
         RETURNING id`,
        [input.lifecycleId, channel, input.pageId],
      );
      accountId = Number((inserted.rows[0] as { id?: unknown }).id);
    } else {
      await this.db.query(
        `UPDATE cmkt_channel_accounts
            SET lifecycle_id = $2, updated_at = NOW()
          WHERE id = $1`,
        [accountId, input.lifecycleId],
      );
    }
    await this.db.query(
      `INSERT INTO cmkt_connectors (
          channel_account_id, connector_id, channel, status, expires_at, access_token, refresh_token
       ) VALUES ($1, $2, $3, 'on', $4, $5, $6)
       ON CONFLICT (connector_id) DO UPDATE SET
          channel_account_id = EXCLUDED.channel_account_id,
          status = 'on',
          expires_at = EXCLUDED.expires_at,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          updated_at = NOW()`,
      [accountId, connectorId, channel, input.expiresAt, input.accessToken, input.refreshToken ?? null],
    );
  }

  async listChannelAccountsPublic(lifecycleIds: number[]): Promise<
    Array<{
      id: number;
      channel: string;
      display_name: string;
      account_ref: string;
      status: string | null;
      expires_at: string | null;
    }>
  > {
    if (!lifecycleIds.length) return [];
    const res = await this.db.query(
      `SELECT a.id, a.channel, a.display_name, a.account_ref,
              c.status, c.expires_at
         FROM cmkt_channel_accounts a
         LEFT JOIN cmkt_connectors c ON c.channel_account_id = a.id
        WHERE a.lifecycle_id = ANY($1::bigint[])
        ORDER BY a.id ASC`,
      [lifecycleIds],
    );
    return res.rows.map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        id: Number(rec.id),
        channel: String(rec.channel ?? ''),
        display_name: String(rec.display_name ?? ''),
        account_ref: String(rec.account_ref ?? ''),
        status: rec.status != null ? String(rec.status) : null,
        expires_at: this.isoOrNull(rec.expires_at),
      };
    });
  }

  async getConnectorById(
    connectorId: number,
    lifecycleIds: number[],
  ): Promise<{
    id: number;
    channel_account_id: number;
    status: string;
    channel?: string;
    expires_at?: string | null;
  } | null> {
    if (!lifecycleIds.length) return null;
    const res = await this.db.query(
      `SELECT c.id, c.channel_account_id, c.status, c.channel, c.expires_at
         FROM cmkt_connectors c
         JOIN cmkt_channel_accounts a ON a.id = c.channel_account_id
        WHERE c.id = $1
          AND a.lifecycle_id = ANY($2::bigint[])`,
      [connectorId, lifecycleIds],
    );
    const rec = res.rows[0] as Record<string, unknown> | undefined;
    if (!rec) return null;
    return {
      id: Number(rec.id),
      channel_account_id: Number(rec.channel_account_id),
      status: String(rec.status ?? ''),
      channel: rec.channel != null ? String(rec.channel) : undefined,
      expires_at: this.isoOrNull(rec.expires_at),
    };
  }

  async clearConnectorSecrets(connectorId: number): Promise<{
    id: number;
    status: string;
    expires_at: string | null;
  }> {
    const res = await this.db.query(
      `UPDATE cmkt_connectors
          SET access_token = NULL, refresh_token = NULL, status = 'off', updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, expires_at`,
      [connectorId],
    );
    const rec = res.rows[0] as Record<string, unknown> | undefined;
    return {
      id: rec ? Number(rec.id) : connectorId,
      status: rec ? String(rec.status ?? 'off') : 'off',
      expires_at: rec ? this.isoOrNull(rec.expires_at) : null,
    };
  }

  private isoOrNull(value: unknown): string | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    }
    const parsed = new Date(String(value));
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : String(value);
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
