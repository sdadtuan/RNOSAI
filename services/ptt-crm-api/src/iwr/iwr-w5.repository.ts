import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  IWR_TENANT_ID,
  type IwrApprovalKind,
  type IwrApprovalRow,
  type IwrApprovalStatus,
  type IwrDashRole,
  type IwrFieldSensitivity,
  type IwrReportRow,
  type IwrReportStatus,
  type IwrRag,
  type IwrSavedReport,
  type IwrSavedReportQuery,
  type IwrSavedReportViz,
  type IwrTemplateFieldRow,
  type IwrTemplateVersionRow,
  type IwrWebhookRow,
} from './iwr.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapSaved(row: Record<string, unknown>): IwrSavedReport {
  return {
    id: text(row.id),
    name_vi: text(row.name_vi),
    owner_staff_id: num(row.owner_staff_id) ?? 0,
    query_json: (row.query_json as IwrSavedReportQuery) ?? {},
    viz: text(row.viz) as IwrSavedReportViz,
    shared_staff_ids: Array.isArray(row.shared_staff_ids)
      ? row.shared_staff_ids.map((v) => Number(v))
      : [],
  };
}

function mapVersion(row: Record<string, unknown>): IwrTemplateVersionRow {
  const sections = row.sections_json;
  return {
    id: text(row.id),
    template_id: text(row.template_id),
    version: text(row.version),
    effective_from: text(row.effective_from).slice(0, 10),
    sections_json: Array.isArray(sections) ? sections.map(String) : [],
  };
}

function mapField(row: Record<string, unknown>): IwrTemplateFieldRow {
  return {
    id: text(row.id),
    template_version_id: text(row.template_version_id),
    field_key: text(row.field_key),
    label_vi: text(row.label_vi),
    sensitivity: text(row.sensitivity) as IwrFieldSensitivity,
    sort_order: num(row.sort_order) ?? 0,
  };
}

function mapApproval(row: Record<string, unknown>): IwrApprovalRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    kind: text(row.kind) as IwrApprovalKind,
    requester_staff_id: num(row.requester_staff_id) ?? 0,
    approver_staff_id: num(row.approver_staff_id) ?? 0,
    status: text(row.status) as IwrApprovalStatus,
    payload_json: (row.payload_json as Record<string, unknown>) ?? {},
    decided_at: row.decided_at != null ? text(row.decided_at) : null,
    decided_by_staff_id: num(row.decided_by_staff_id),
    decision_note: row.decision_note != null ? text(row.decision_note) : null,
    created_at: text(row.created_at),
  };
}

function mapWebhook(row: Record<string, unknown>): IwrWebhookRow {
  return {
    id: text(row.id),
    name_vi: text(row.name_vi),
    url: text(row.url),
    events: Array.isArray(row.events) ? row.events.map(String) : [],
    active: Boolean(row.active),
    owner_staff_id: num(row.owner_staff_id) ?? 0,
  };
}

const REPORT_SELECT = `
  SELECT r.*,
         t.code AS template_code,
         t.name_vi AS template_name_vi,
         a.name AS author_name
    FROM iwr_reports r
    JOIN iwr_templates t ON t.id = r.template_id
    LEFT JOIN crm_staff a ON a.id = r.author_staff_id
`;

function mapReport(row: Record<string, unknown>): IwrReportRow {
  return {
    id: text(row.id),
    template_id: text(row.template_id),
    template_code: text(row.template_code),
    template_name_vi: text(row.template_name_vi),
    title: text(row.title),
    author_staff_id: num(row.author_staff_id) ?? 0,
    author_name: row.author_name != null ? text(row.author_name) : undefined,
    reviewer_staff_id: num(row.reviewer_staff_id),
    period_start: text(row.period_start).slice(0, 10),
    period_end: text(row.period_end).slice(0, 10),
    due_at: text(row.due_at),
    status: text(row.status) as IwrReportStatus,
    version: text(row.version),
    rag: row.rag != null ? (text(row.rag) as IwrRag) : null,
    is_late: Boolean(row.is_late),
    late_reason: row.late_reason != null ? text(row.late_reason) : null,
    first_viewed_at: row.first_viewed_at != null ? text(row.first_viewed_at) : null,
    submitted_at: row.submitted_at != null ? text(row.submitted_at) : null,
    acknowledged_at: row.acknowledged_at != null ? text(row.acknowledged_at) : null,
    sensitivity: row.sensitivity != null ? text(row.sensitivity) : 'internal',
    sections_json: (row.sections_json as Record<string, unknown>) ?? {},
    template_version_id: row.template_version_id != null ? text(row.template_version_id) : null,
  };
}

@Injectable()
export class IwrW5Repository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async getEffectiveTemplateVersionId(templateId: string, ymd: string): Promise<string | null> {
    const res = await this.db.query(
      `SELECT id FROM iwr_template_versions
        WHERE tenant_id = $1 AND template_id = $2 AND effective_from <= $3::date
        ORDER BY effective_from DESC, created_at DESC
        LIMIT 1`,
      [IWR_TENANT_ID, templateId, ymd],
    );
    return res.rows[0] ? text(res.rows[0].id) : null;
  }

  async listTemplateVersions(templateId: string): Promise<IwrTemplateVersionRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_template_versions
        WHERE tenant_id = $1 AND template_id = $2
        ORDER BY effective_from DESC`,
      [IWR_TENANT_ID, templateId],
    );
    return res.rows.map(mapVersion);
  }

  async createTemplateVersion(input: {
    template_id: string;
    version: string;
    effective_from: string;
    sections_json: string[];
  }): Promise<IwrTemplateVersionRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_template_versions (tenant_id, template_id, version, effective_from, sections_json)
       VALUES ($1, $2, $3, $4::date, $5::jsonb)
       RETURNING *`,
      [
        IWR_TENANT_ID,
        input.template_id,
        input.version,
        input.effective_from,
        JSON.stringify(input.sections_json),
      ],
    );
    return mapVersion(res.rows[0]);
  }

  async listTemplateFields(templateVersionId: string): Promise<IwrTemplateFieldRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_template_fields
        WHERE template_version_id = $1
        ORDER BY sort_order, field_key`,
      [templateVersionId],
    );
    return res.rows.map(mapField);
  }

  async listFieldsForReport(reportId: string): Promise<IwrTemplateFieldRow[]> {
    const res = await this.db.query(
      `SELECT f.*
         FROM iwr_reports r
         JOIN iwr_template_fields f ON f.template_version_id = r.template_version_id
        WHERE r.id = $1 AND r.tenant_id = $2`,
      [reportId, IWR_TENANT_ID],
    );
    if ((res.rowCount ?? 0) > 0) return res.rows.map(mapField);
    const fallback = await this.db.query(
      `SELECT f.*
         FROM iwr_reports r
         JOIN iwr_template_versions v ON v.template_id = r.template_id AND v.version = 'v1.0'
         JOIN iwr_template_fields f ON f.template_version_id = v.id
        WHERE r.id = $1 AND r.tenant_id = $2`,
      [reportId, IWR_TENANT_ID],
    );
    return fallback.rows.map(mapField);
  }

  async listSavedReports(staffId: number, manage: boolean): Promise<IwrSavedReport[]> {
    const res = manage
      ? await this.db.query(
          `SELECT * FROM iwr_saved_reports WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 200`,
          [IWR_TENANT_ID],
        )
      : await this.db.query(
          `SELECT * FROM iwr_saved_reports
            WHERE tenant_id = $1
              AND (owner_staff_id = $2 OR $2 = ANY(shared_staff_ids))
            ORDER BY updated_at DESC LIMIT 200`,
          [IWR_TENANT_ID, staffId],
        );
    return res.rows.map(mapSaved);
  }

  async getSavedReport(id: string): Promise<IwrSavedReport | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_saved_reports WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [IWR_TENANT_ID, id],
    );
    return res.rows[0] ? mapSaved(res.rows[0]) : null;
  }

  async insertSavedReport(input: {
    name_vi: string;
    owner_staff_id: number;
    query_json: IwrSavedReportQuery;
    viz: IwrSavedReportViz;
  }): Promise<IwrSavedReport> {
    const res = await this.db.query(
      `INSERT INTO iwr_saved_reports (tenant_id, name_vi, owner_staff_id, query_json, viz)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING *`,
      [IWR_TENANT_ID, input.name_vi, input.owner_staff_id, JSON.stringify(input.query_json), input.viz],
    );
    return mapSaved(res.rows[0]);
  }

  async shareSavedReport(id: string, staffIds: number[]): Promise<IwrSavedReport> {
    const res = await this.db.query(
      `UPDATE iwr_saved_reports
          SET shared_staff_ids = (
            SELECT ARRAY(SELECT DISTINCT unnest(shared_staff_ids || $3::int[]))
          ),
              updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      [IWR_TENANT_ID, id, staffIds],
    );
    if (!res.rows[0]) throw Object.assign(new Error('not found'), { status: 404 });
    return mapSaved(res.rows[0]);
  }

  buildQueryFilters(query: IwrSavedReportQuery): { where: string; params: unknown[] } {
    const clauses = ['r.tenant_id = $1', 'r.is_deleted = FALSE'];
    const params: unknown[] = [IWR_TENANT_ID];
    let idx = 2;
    if (query.template_codes?.length) {
      clauses.push(`t.code = ANY($${idx++}::text[])`);
      params.push(query.template_codes);
    }
    if (query.statuses?.length) {
      clauses.push(`r.status = ANY($${idx++}::text[])`);
      params.push(query.statuses);
    }
    if (query.period_start) {
      clauses.push(`r.period_start >= $${idx++}::date`);
      params.push(query.period_start);
    }
    if (query.period_end) {
      clauses.push(`r.period_end <= $${idx++}::date`);
      params.push(query.period_end);
    }
    if (query.department_id != null) {
      clauses.push(`a.department_id = $${idx++}`);
      params.push(query.department_id);
    }
    if (query.rag?.length) {
      clauses.push(`r.rag = ANY($${idx++}::text[])`);
      params.push(query.rag);
    }
    return { where: clauses.join(' AND '), params };
  }

  async countBuilderQuery(query: IwrSavedReportQuery): Promise<number> {
    const { where, params } = this.buildQueryFilters(query);
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c
         FROM iwr_reports r
         JOIN iwr_templates t ON t.id = r.template_id
         LEFT JOIN crm_staff a ON a.id = r.author_staff_id
        WHERE ${where}`,
      params,
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async runBuilderQuery(query: IwrSavedReportQuery, limit: number): Promise<IwrReportRow[]> {
    const { where, params } = this.buildQueryFilters(query);
    params.push(limit);
    const res = await this.db.query(
      `${REPORT_SELECT}
        WHERE ${where}
        ORDER BY r.period_start DESC, r.created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return res.rows.map(mapReport);
  }

  async queueExportJob(savedReportId: string, staffId: number): Promise<string> {
    const eventKey = `iwr:export_run:${savedReportId}:${staffId}:${Date.now()}`;
    const res = await this.db.query(
      `INSERT INTO iwr_jobs (tenant_id, event_key, kind, payload_json, status)
       VALUES ($1, $2, 'export_run', $3::jsonb, 'queued')
       ON CONFLICT (tenant_id, event_key) DO NOTHING
       RETURNING id`,
      [
        IWR_TENANT_ID,
        eventKey,
        JSON.stringify({ saved_report_id: savedReportId, staff_id: staffId }),
      ],
    );
    return res.rows[0] ? text(res.rows[0].id) : eventKey;
  }

  async listApprovals(staffId: number, manage: boolean): Promise<IwrApprovalRow[]> {
    const res = manage
      ? await this.db.query(
          `SELECT * FROM iwr_approvals WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
          [IWR_TENANT_ID],
        )
      : await this.db.query(
          `SELECT * FROM iwr_approvals
            WHERE tenant_id = $1
              AND (requester_staff_id = $2 OR approver_staff_id = $2)
            ORDER BY created_at DESC LIMIT 200`,
          [IWR_TENANT_ID, staffId],
        );
    return res.rows.map(mapApproval);
  }

  async insertApproval(input: {
    report_id: string;
    kind: IwrApprovalKind;
    requester_staff_id: number;
    approver_staff_id: number;
    payload_json?: Record<string, unknown>;
  }): Promise<IwrApprovalRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_approvals (
         tenant_id, report_id, kind, requester_staff_id, approver_staff_id, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [
        IWR_TENANT_ID,
        input.report_id,
        input.kind,
        input.requester_staff_id,
        input.approver_staff_id,
        JSON.stringify(input.payload_json ?? {}),
      ],
    );
    return mapApproval(res.rows[0]);
  }

  async decideApproval(
    id: string,
    approverStaffId: number,
    status: 'approved' | 'rejected',
    note?: string,
  ): Promise<IwrApprovalRow | null> {
    const res = await this.db.query(
      `UPDATE iwr_approvals
          SET status = $4,
              decided_at = NOW(),
              decided_by_staff_id = $3,
              decision_note = $5
        WHERE tenant_id = $1 AND id = $2 AND approver_staff_id = $3 AND status = 'pending'
        RETURNING *`,
      [IWR_TENANT_ID, id, approverStaffId, status, note ?? null],
    );
    return res.rows[0] ? mapApproval(res.rows[0]) : null;
  }

  async getApproval(id: string): Promise<IwrApprovalRow | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_approvals WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [IWR_TENANT_ID, id],
    );
    return res.rows[0] ? mapApproval(res.rows[0]) : null;
  }

  async reopenReport(id: string): Promise<IwrReportRow | null> {
    const res = await this.db.query(
      `UPDATE iwr_reports
          SET status = 'draft', updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE
        RETURNING id`,
      [IWR_TENANT_ID, id],
    );
    if (!res.rows[0]) return null;
    const row = await this.db.query(`${REPORT_SELECT} WHERE r.id = $1`, [id]);
    return row.rows[0] ? mapReport(row.rows[0]) : null;
  }

  async listWebhooks(staffId: number, manage: boolean): Promise<IwrWebhookRow[]> {
    const res = manage
      ? await this.db.query(
          `SELECT id, name_vi, url, events, active, owner_staff_id FROM iwr_webhooks
            WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`,
          [IWR_TENANT_ID],
        )
      : await this.db.query(
          `SELECT id, name_vi, url, events, active, owner_staff_id FROM iwr_webhooks
            WHERE tenant_id = $1 AND owner_staff_id = $2 ORDER BY created_at DESC LIMIT 100`,
          [IWR_TENANT_ID, staffId],
        );
    return res.rows.map(mapWebhook);
  }

  async insertWebhook(input: {
    name_vi: string;
    url: string;
    secret: string;
    events: string[];
    owner_staff_id: number;
  }): Promise<IwrWebhookRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_webhooks (tenant_id, name_vi, url, secret, events, owner_staff_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name_vi, url, events, active, owner_staff_id`,
      [IWR_TENANT_ID, input.name_vi, input.url, input.secret, input.events, input.owner_staff_id],
    );
    return mapWebhook(res.rows[0]);
  }

  async getWebhook(id: string): Promise<(IwrWebhookRow & { secret: string }) | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_webhooks WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [IWR_TENANT_ID, id],
    );
    if (!res.rows[0]) return null;
    return { ...mapWebhook(res.rows[0]), secret: text(res.rows[0].secret) };
  }
}

export function signWebhookBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
