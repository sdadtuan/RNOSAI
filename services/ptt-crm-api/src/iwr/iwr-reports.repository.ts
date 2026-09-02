import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  IWR_TENANT_ID,
  type IwrCommentRow,
  type IwrInboxBox,
  type IwrRecipientKind,
  type IwrRecipientRow,
  type IwrReportRow,
  type IwrReportStatus,
  type IwrRag,
  type IwrStaffNode,
  type IwrTemplateRow,
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

function mapTemplate(row: Record<string, unknown>): IwrTemplateRow {
  const sections = row.sections_json;
  return {
    id: text(row.id),
    code: text(row.code),
    name_vi: text(row.name_vi),
    kind: text(row.kind),
    sections_json: Array.isArray(sections) ? sections.map(String) : [],
    due_rule_json: (row.due_rule_json as Record<string, unknown>) ?? {},
    active: Boolean(row.active),
  };
}

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
    sections_json: (row.sections_json as Record<string, unknown>) ?? {},
    source_report_ids: Array.isArray(row.source_report_ids)
      ? row.source_report_ids.map(String)
      : undefined,
  };
}

function mapRecipient(row: Record<string, unknown>): IwrRecipientRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    staff_id: num(row.staff_id) ?? 0,
    kind: text(row.kind) as IwrRecipientKind,
    staff_name: row.staff_name != null ? text(row.staff_name) : undefined,
  };
}

function mapComment(row: Record<string, unknown>): IwrCommentRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    section_key: text(row.section_key),
    body_text: text(row.body_text),
    created_by_staff_id: num(row.created_by_staff_id) ?? 0,
    created_at: text(row.created_at),
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

@Injectable()
export class IwrOrgRepository implements OnModuleDestroy {
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

  async getStaff(id: number): Promise<IwrStaffNode | null> {
    const res = await this.db.query(
      `SELECT id, name, email, department_id, reports_to_id, active
         FROM crm_staff
        WHERE id = $1 AND active = TRUE
        LIMIT 1`,
      [id],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      name: text(row.name),
      email: row.email != null ? text(row.email) : null,
      department_id: num(row.department_id),
      reports_to_id: num(row.reports_to_id),
      active: Boolean(row.active),
    };
  }

  async listActiveStaff(): Promise<IwrStaffNode[]> {
    const res = await this.db.query(
      `SELECT id, name, email, department_id, reports_to_id, active
         FROM crm_staff
        WHERE active = TRUE
        ORDER BY name`,
    );
    return res.rows.map((row) => ({
      id: Number(row.id),
      name: text(row.name),
      email: row.email != null ? text(row.email) : null,
      department_id: num(row.department_id),
      reports_to_id: num(row.reports_to_id),
      active: Boolean(row.active),
    }));
  }

  async searchDirectory(q: string, limit: number): Promise<IwrStaffNode[]> {
    const lim = Math.min(Math.max(limit, 1), 20);
    const term = `%${String(q ?? '').trim()}%`;
    const res = await this.db.query(
      `SELECT id, name, email, department_id, reports_to_id, active
         FROM crm_staff
        WHERE active = TRUE
          AND (
            name ILIKE $1
            OR email ILIKE $1
            OR internal_code ILIKE $1
          )
        ORDER BY name
        LIMIT $2`,
      [term, lim],
    );
    return res.rows.map((row) => ({
      id: Number(row.id),
      name: text(row.name),
      email: row.email != null ? text(row.email) : null,
      department_id: num(row.department_id),
      reports_to_id: num(row.reports_to_id),
      active: Boolean(row.active),
    }));
  }
}

@Injectable()
export class IwrReportsRepository implements OnModuleDestroy {
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

  async getTemplateByCode(code: string): Promise<IwrTemplateRow | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_templates
        WHERE tenant_id = $1 AND code = $2 AND active = TRUE
        LIMIT 1`,
      [IWR_TENANT_ID, code],
    );
    const row = res.rows[0];
    return row ? mapTemplate(row) : null;
  }

  async listTemplates(): Promise<IwrTemplateRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_templates
        WHERE tenant_id = $1
        ORDER BY code`,
      [IWR_TENANT_ID],
    );
    return res.rows.map(mapTemplate);
  }

  async updateTemplate(
    id: string,
    patch: { name_vi?: string; sections_json?: string[]; due_rule_json?: Record<string, unknown> },
  ): Promise<IwrTemplateRow> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [IWR_TENANT_ID, id];
    let idx = 3;
    if (patch.name_vi !== undefined) {
      sets.push(`name_vi = $${idx++}`);
      params.push(patch.name_vi);
    }
    if (patch.sections_json !== undefined) {
      sets.push(`sections_json = $${idx++}::jsonb`);
      params.push(JSON.stringify(patch.sections_json));
    }
    if (patch.due_rule_json !== undefined) {
      sets.push(`due_rule_json = $${idx++}::jsonb`);
      params.push(JSON.stringify(patch.due_rule_json));
    }
    const res = await this.db.query(
      `UPDATE iwr_templates SET ${sets.join(', ')}
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      params,
    );
    if (!res.rows[0]) throw Object.assign(new Error('not found'), { status: 404 });
    return mapTemplate(res.rows[0]);
  }

  async insertReport(input: {
    template_id: string;
    title: string;
    author_staff_id: number;
    reviewer_staff_id: number | null;
    period_start: string;
    period_end: string;
    due_at: string;
    sections_json: Record<string, unknown>;
  }): Promise<IwrReportRow> {
    try {
      const res = await this.db.query(
        `INSERT INTO iwr_reports (
           tenant_id, template_id, title, author_staff_id, reviewer_staff_id,
           period_start, period_end, due_at, sections_json, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
         RETURNING id`,
        [
          IWR_TENANT_ID,
          input.template_id,
          input.title,
          input.author_staff_id,
          input.reviewer_staff_id,
          input.period_start,
          input.period_end,
          input.due_at,
          JSON.stringify(input.sections_json),
        ],
      );
      const id = text(res.rows[0].id);
      const row = await this.getReport(id);
      if (!row) throw new Error('insert failed');
      return row;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async getReport(id: string): Promise<IwrReportRow | null> {
    const res = await this.db.query(
      `${REPORT_SELECT}
        WHERE r.tenant_id = $1 AND r.id = $2 AND r.is_deleted = FALSE
        LIMIT 1`,
      [IWR_TENANT_ID, id],
    );
    const row = res.rows[0];
    if (!row) return null;
    const sources = await this.db.query(
      `SELECT source_report_id FROM iwr_report_sources WHERE report_id = $1`,
      [id],
    );
    return mapReport({
      ...row,
      source_report_ids: sources.rows.map((s) => s.source_report_id),
    });
  }

  async listMine(
    authorStaffId: number,
    query: { status?: string; template_code?: string },
  ): Promise<IwrReportRow[]> {
    const params: unknown[] = [IWR_TENANT_ID, authorStaffId];
    let extra = '';
    if (query.status) {
      params.push(query.status);
      extra += ` AND r.status = $${params.length}`;
    }
    if (query.template_code) {
      params.push(query.template_code);
      extra += ` AND t.code = $${params.length}`;
    }
    const res = await this.db.query(
      `${REPORT_SELECT}
        WHERE r.tenant_id = $1 AND r.author_staff_id = $2 AND r.is_deleted = FALSE ${extra}
        ORDER BY r.period_start DESC, r.updated_at DESC
        LIMIT 200`,
      params,
    );
    return res.rows.map(mapReport);
  }

  async listForPeriod(input: {
    period_start: string;
    period_end: string;
    template_code?: string;
    author_ids?: number[];
  }): Promise<IwrReportRow[]> {
    const params: unknown[] = [IWR_TENANT_ID, input.period_start, input.period_end];
    let extra = '';
    if (input.template_code) {
      params.push(input.template_code);
      extra += ` AND t.code = $${params.length}`;
    }
    if (input.author_ids?.length) {
      params.push(input.author_ids);
      extra += ` AND r.author_staff_id = ANY($${params.length}::int[])`;
    }
    const res = await this.db.query(
      `${REPORT_SELECT}
        WHERE r.tenant_id = $1
          AND r.period_start = $2::date
          AND r.period_end = $3::date
          AND r.is_deleted = FALSE ${extra}
        ORDER BY a.name`,
      params,
    );
    return res.rows.map(mapReport);
  }

  async updateSections(
    id: string,
    sections: Record<string, unknown>,
    patch?: { title?: string; rag?: IwrRag },
  ): Promise<IwrReportRow> {
    const sets = ['sections_json = $3::jsonb', 'updated_at = NOW()'];
    const params: unknown[] = [IWR_TENANT_ID, id, JSON.stringify(sections)];
    let idx = 4;
    if (patch?.title !== undefined) {
      sets.push(`title = $${idx++}`);
      params.push(patch.title);
    }
    if (patch?.rag !== undefined) {
      sets.push(`rag = $${idx++}`);
      params.push(patch.rag);
    }
    await this.db.query(
      `UPDATE iwr_reports SET ${sets.join(', ')}
        WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE`,
      params,
    );
    const row = await this.getReport(id);
    if (!row) throw new Error('not found');
    return row;
  }

  async updateStatus(
    id: string,
    patch: Partial<IwrReportRow> & { status: IwrReportStatus },
  ): Promise<IwrReportRow> {
    const fields: string[] = ['status = $3', 'updated_at = NOW()'];
    const params: unknown[] = [IWR_TENANT_ID, id, patch.status];
    let idx = 4;
    const add = (col: string, val: unknown) => {
      if (val !== undefined) {
        fields.push(`${col} = $${idx++}`);
        params.push(val);
      }
    };
    add('reviewer_staff_id', patch.reviewer_staff_id);
    add('submitted_at', patch.submitted_at);
    add('acknowledged_at', patch.acknowledged_at);
    add('acknowledged_by_staff_id', (patch as { acknowledged_by_staff_id?: number }).acknowledged_by_staff_id);
    add('waived_at', patch.waived_at);
    add('waived_by_staff_id', (patch as { waived_by_staff_id?: number }).waived_by_staff_id);
    add('waive_reason', (patch as { waive_reason?: string }).waive_reason);
    add('is_late', patch.is_late);
    add('late_reason', patch.late_reason);
    add('version', patch.version);
    add('rag', patch.rag);
    add('first_viewed_at', patch.first_viewed_at);
    add('first_viewed_by_staff_id', (patch as { first_viewed_by_staff_id?: number }).first_viewed_by_staff_id);
    await this.db.query(
      `UPDATE iwr_reports SET ${fields.join(', ')}
        WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE`,
      params,
    );
    const row = await this.getReport(id);
    if (!row) throw new Error('not found');
    return row;
  }

  async replaceRecipients(
    reportId: string,
    rows: { staff_id: number; kind: IwrRecipientKind }[],
  ): Promise<void> {
    await this.db.query(`DELETE FROM iwr_report_recipients WHERE report_id = $1`, [reportId]);
    for (const r of rows) {
      await this.db.query(
        `INSERT INTO iwr_report_recipients (tenant_id, report_id, staff_id, kind)
         VALUES ($1, $2, $3, $4)`,
        [IWR_TENANT_ID, reportId, r.staff_id, r.kind],
      );
    }
  }

  async listRecipients(reportId: string): Promise<IwrRecipientRow[]> {
    const res = await this.db.query(
      `SELECT rec.*, s.name AS staff_name
         FROM iwr_report_recipients rec
         LEFT JOIN crm_staff s ON s.id = rec.staff_id
        WHERE rec.report_id = $1
        ORDER BY CASE rec.kind WHEN 'to' THEN 0 WHEN 'cc' THEN 1 ELSE 2 END, s.name`,
      [reportId],
    );
    return res.rows.map(mapRecipient);
  }

  async insertComment(input: {
    report_id: string;
    section_key: string;
    body_text: string;
    created_by_staff_id: number;
  }): Promise<IwrCommentRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_comments (report_id, section_key, body_text, created_by_staff_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.report_id, input.section_key, input.body_text, input.created_by_staff_id],
    );
    return mapComment(res.rows[0]);
  }

  async listComments(reportId: string, sectionKey?: string): Promise<IwrCommentRow[]> {
    const params: unknown[] = [reportId];
    let extra = '';
    if (sectionKey !== undefined) {
      params.push(sectionKey);
      extra = ' AND section_key = $2';
    }
    const res = await this.db.query(
      `SELECT * FROM iwr_comments
        WHERE report_id = $1 ${extra}
        ORDER BY created_at ASC`,
      params,
    );
    return res.rows.map(mapComment);
  }

  async hasReviewerComment(reportId: string, reviewerStaffId: number): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM iwr_comments
        WHERE report_id = $1 AND created_by_staff_id = $2
        LIMIT 1`,
      [reportId, reviewerStaffId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async insertVersionSnapshot(
    reportId: string,
    version: string,
    status: string,
    sections: Record<string, unknown>,
    createdBy?: number,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO iwr_report_versions (report_id, version, status, sections_json, created_by_staff_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, version, status, JSON.stringify(sections), createdBy ?? null],
    );
  }

  async listVersions(reportId: string): Promise<{ version: string; status: string; created_at: string }[]> {
    const res = await this.db.query(
      `SELECT version, status, created_at FROM iwr_report_versions
        WHERE report_id = $1 ORDER BY created_at DESC`,
      [reportId],
    );
    return res.rows.map((row) => ({
      version: text(row.version),
      status: text(row.status),
      created_at: text(row.created_at),
    }));
  }

  async replaceSources(reportId: string, sourceIds: string[]): Promise<void> {
    await this.db.query(`DELETE FROM iwr_report_sources WHERE report_id = $1`, [reportId]);
    for (const sid of sourceIds) {
      await this.db.query(
        `INSERT INTO iwr_report_sources (report_id, source_report_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [reportId, sid],
      );
    }
  }

  async listInbox(staffId: number, box: IwrInboxBox): Promise<IwrReportRow[]> {
    if (box === 'draft') {
      const res = await this.db.query(
        `${REPORT_SELECT}
          WHERE r.tenant_id = $1 AND r.author_staff_id = $2
            AND r.status = 'draft' AND r.is_deleted = FALSE
          ORDER BY r.updated_at DESC LIMIT 200`,
        [IWR_TENANT_ID, staffId],
      );
      return res.rows.map(mapReport);
    }

    if (box === 'sent') {
      const res = await this.db.query(
        `${REPORT_SELECT}
          WHERE r.tenant_id = $1 AND r.author_staff_id = $2
            AND r.status <> 'draft' AND r.is_deleted = FALSE
          ORDER BY r.submitted_at DESC NULLS LAST, r.updated_at DESC LIMIT 200`,
        [IWR_TENANT_ID, staffId],
      );
      return res.rows.map(mapReport);
    }

    let statusFilter = '';
    if (box === 'action') {
      statusFilter = ` AND r.status IN ('submitted','supplemented','changes_requested') AND rec.kind = 'to'`;
    } else if (box === 'unread') {
      statusFilter = ` AND r.first_viewed_at IS NULL AND r.status NOT IN ('draft','waived')`;
    }

    const kindFilter = box === 'action' ? '' : ` AND rec.kind IN ('to','cc')`;

    const res = await this.db.query(
      `${REPORT_SELECT}
        JOIN iwr_report_recipients rec ON rec.report_id = r.id AND rec.staff_id = $2
        WHERE r.tenant_id = $1 AND r.is_deleted = FALSE ${kindFilter} ${statusFilter}
        ORDER BY r.submitted_at DESC NULLS LAST, r.updated_at DESC
        LIMIT 200`,
      [IWR_TENANT_ID, staffId],
    );
    return res.rows.map(mapReport);
  }

  async isRecipient(reportId: string, staffId: number): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM iwr_report_recipients WHERE report_id = $1 AND staff_id = $2 LIMIT 1`,
      [reportId, staffId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
