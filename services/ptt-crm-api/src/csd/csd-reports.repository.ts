import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CSD_TENANT_ID,
  CsdAttachmentRow,
  CsdReportListQuery,
  CsdReportRecurrence,
  CsdReportRow,
  CsdReportScheduleRow,
  CsdReportSendLogRow,
  CsdReportStatus,
  CsdReportVersionRow,
} from './csd.types';

const DUE_STATUSES_SQL =
  "'draft','data_pending','in_review','changes_requested','approved','scheduled'";

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

function mapReport(row: Record<string, unknown>, template?: Record<string, unknown>): CsdReportRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    template_id: row.template_id != null ? text(row.template_id) : null,
    template_code: template ? text(template.code) : null,
    title: text(row.title),
    status: text(row.status) as CsdReportStatus,
    client_account_id: row.client_account_id != null ? text(row.client_account_id) : null,
    period_start: text(row.period_start).slice(0, 10),
    period_end: text(row.period_end).slice(0, 10),
    owner_staff_id: num(row.owner_staff_id),
    approver_staff_id: num(row.approver_staff_id),
    current_version: text(row.current_version),
    requires_approval: template ? Boolean(template.requires_approval) : true,
    created_at: text(row.created_at),
    created_by_staff_id: num(row.created_by_staff_id),
    updated_at: text(row.updated_at),
  };
}

function mapVersion(row: Record<string, unknown>): CsdReportVersionRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    version: text(row.version),
    status: text(row.status) as CsdReportStatus,
    sections_json: (row.sections_json as Record<string, unknown>) ?? {},
    changelog: text(row.changelog),
    created_at: text(row.created_at),
    created_by_staff_id: num(row.created_by_staff_id),
  };
}

function mapAttachment(row: Record<string, unknown>): CsdAttachmentRow {
  return {
    id: text(row.id),
    file_name: text(row.file_name),
    mime_type: text(row.mime_type),
    byte_size: num(row.byte_size) ?? 0,
    visibility: text(row.visibility) as CsdAttachmentRow['visibility'],
    entity_type: text(row.entity_type),
    entity_id: text(row.entity_id),
    storage_key: text(row.storage_key),
    created_at: text(row.created_at),
  };
}

function mapSchedule(row: Record<string, unknown>): CsdReportScheduleRow {
  return {
    id: text(row.id),
    tenant_id: text(row.tenant_id),
    template_id: text(row.template_id),
    template_code: text(row.template_code),
    client_account_id: row.client_account_id != null ? text(row.client_account_id) : null,
    recurrence: text(row.recurrence) as CsdReportRecurrence,
    next_run_at: row.next_run_at != null ? text(row.next_run_at) : null,
    owner_staff_id: num(row.owner_staff_id),
    approver_staff_id: num(row.approver_staff_id),
    active: Boolean(row.active),
    created_at: text(row.created_at),
  };
}

function mapSendLog(row: Record<string, unknown>): CsdReportSendLogRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    version: text(row.version),
    channel: text(row.channel),
    to_json: (row.to_json as string[]) ?? [],
    result: text(row.result),
    email_id: row.email_id != null ? text(row.email_id) : null,
    error_text: row.error_text != null ? text(row.error_text) : null,
    created_at: text(row.created_at),
    created_by_staff_id: num(row.created_by_staff_id),
  };
}

@Injectable()
export class CsdReportsRepository implements OnModuleDestroy {
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

  async getTemplateByCode(code: string): Promise<{
    id: string;
    code: string;
    name_vi: string;
    requires_approval: boolean;
    sections_json: string[];
  } | null> {
    const res = await this.db.query(
      `SELECT * FROM csd_report_templates
       WHERE tenant_id = $1 AND code = $2 AND active = TRUE
       LIMIT 1`,
      [CSD_TENANT_ID, code],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      id: text(row.id),
      code: text(row.code),
      name_vi: text(row.name_vi),
      requires_approval: Boolean(row.requires_approval),
      sections_json: (row.sections_json as string[]) ?? [],
    };
  }

  async insertReport(input: {
    template_id: string;
    title: string;
    client_account_id?: string | null;
    period_start: string;
    period_end: string;
    owner_staff_id: number;
    created_by_staff_id: number;
    sections_json: Record<string, unknown>;
  }): Promise<CsdReportRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO csd_reports (
           tenant_id, template_id, title, status, client_account_id,
           period_start, period_end, owner_staff_id, current_version,
           created_by_staff_id, updated_by_staff_id
         ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, 'v1.0', $8, $8)
         RETURNING *`,
        [
          CSD_TENANT_ID,
          input.template_id,
          input.title,
          input.client_account_id ?? null,
          input.period_start,
          input.period_end,
          input.owner_staff_id,
          input.created_by_staff_id,
        ],
      );
      const report = res.rows[0];
      await client.query(
        `INSERT INTO csd_report_versions (
           report_id, version, status, sections_json, created_by_staff_id
         ) VALUES ($1, 'v1.0', 'draft', $2, $3)`,
        [report.id, input.sections_json, input.created_by_staff_id],
      );
      await client.query('COMMIT');

      const template = await this.getTemplateByCode(
        (await client.query(`SELECT code FROM csd_report_templates WHERE id = $1`, [input.template_id]))
          .rows[0]?.code ?? '',
      );
      return mapReport(report, template ?? undefined);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listReports(q: CsdReportListQuery): Promise<CsdReportRow[]> {
    const params: unknown[] = [CSD_TENANT_ID];
    const where: string[] = ['r.tenant_id = $1', 'r.is_deleted = FALSE'];

    if (q.status === 'due') {
      where.push(`r.status IN (${DUE_STATUSES_SQL})`);
      where.push('r.period_end <= CURRENT_DATE + 7');
    } else if (q.status) {
      params.push(q.status);
      where.push(`r.status = $${params.length}`);
    }
    if (q.template_code) {
      params.push(q.template_code);
      where.push(`t.code = $${params.length}`);
    }
    if (q.client_account_id) {
      params.push(q.client_account_id);
      where.push(`r.client_account_id = $${params.length}`);
    }
    if (q.q?.trim()) {
      params.push(`%${q.q.trim()}%`);
      where.push(`r.title ILIKE $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(q.limit ?? 100) || 100, 1), 100);
    params.push(limit);

    const res = await this.db.query(
      `SELECT r.*, t.code AS template_code, t.requires_approval
       FROM csd_reports r
       JOIN csd_report_templates t ON t.id = r.template_id
       WHERE ${where.join(' AND ')}
       ORDER BY r.period_end ASC, r.updated_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return res.rows.map((row: Record<string, unknown>) =>
      mapReport(row, {
        code: row.template_code,
        requires_approval: row.requires_approval,
      }),
    );
  }

  async listVersions(reportId: string): Promise<CsdReportVersionRow[]> {
    const res = await this.db.query(
      `SELECT v.* FROM csd_report_versions v
       JOIN csd_reports r ON r.id = v.report_id
       WHERE r.tenant_id = $1 AND r.id = $2 AND r.is_deleted = FALSE
       ORDER BY v.created_at DESC, v.version DESC`,
      [CSD_TENANT_ID, reportId],
    );
    return res.rows.map(mapVersion);
  }

  async listSendLogs(reportId: string): Promise<CsdReportSendLogRow[]> {
    const res = await this.db.query(
      `SELECT l.* FROM csd_report_send_logs l
       JOIN csd_reports r ON r.id = l.report_id
       WHERE r.tenant_id = $1 AND r.id = $2 AND r.is_deleted = FALSE
       ORDER BY l.created_at DESC`,
      [CSD_TENANT_ID, reportId],
    );
    return res.rows.map(mapSendLog);
  }

  async getReport(id: string): Promise<CsdReportRow | null> {
    const res = await this.db.query(
      `SELECT r.*, t.code AS template_code, t.requires_approval
       FROM csd_reports r
       LEFT JOIN csd_report_templates t ON t.id = r.template_id
       WHERE r.tenant_id = $1 AND r.id = $2 AND r.is_deleted = FALSE`,
      [CSD_TENANT_ID, id],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return mapReport(row, {
      code: row.template_code,
      requires_approval: row.requires_approval,
    });
  }

  async updateReportStatus(
    id: string,
    status: CsdReportStatus,
    patch: { approver_staff_id?: number; updated_by_staff_id: number },
  ): Promise<CsdReportRow> {
    const params: unknown[] = [CSD_TENANT_ID, id, status, patch.updated_by_staff_id];
    let approverClause = '';
    if (patch.approver_staff_id != null) {
      params.push(patch.approver_staff_id);
      approverClause = `, approver_staff_id = $${params.length}`;
    }

    const res = await this.db.query(
      `UPDATE csd_reports
       SET status = $3, updated_by_staff_id = $4, updated_at = NOW() ${approverClause}
       WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE
       RETURNING *`,
      params,
    );
    if (!res.rows[0]) throw new NotFoundException({ error: 'csd_report_not_found' });

    await this.db.query(
      `UPDATE csd_report_versions SET status = $3
       WHERE report_id = $1 AND version = (
         SELECT current_version FROM csd_reports WHERE id = $1
       )`,
      [id, id, status],
    );

    return this.getReport(id) as Promise<CsdReportRow>;
  }

  async getCurrentVersion(reportId: string): Promise<CsdReportVersionRow | null> {
    const res = await this.db.query(
      `SELECT v.* FROM csd_report_versions v
       JOIN csd_reports r ON r.id = v.report_id AND r.current_version = v.version
       WHERE r.tenant_id = $1 AND r.id = $2`,
      [CSD_TENANT_ID, reportId],
    );
    return res.rows[0] ? mapVersion(res.rows[0]) : null;
  }

  async updateSections(
    reportId: string,
    version: string,
    sections: Record<string, unknown>,
    actorStaffId: number,
  ): Promise<CsdReportVersionRow> {
    const res = await this.db.query(
      `UPDATE csd_report_versions
       SET sections_json = $4
       WHERE report_id = $1 AND version = $2
         AND EXISTS (
           SELECT 1 FROM csd_reports r
           WHERE r.id = $1 AND r.tenant_id = $3 AND r.status <> 'sent'
         )
       RETURNING *`,
      [reportId, version, CSD_TENANT_ID, sections],
    );
    if (!res.rows[0]) throw new NotFoundException({ error: 'csd_report_version_not_found_or_sent' });

    await this.db.query(
      `UPDATE csd_reports SET updated_by_staff_id = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [reportId, CSD_TENANT_ID, actorStaffId],
    );

    return mapVersion(res.rows[0]);
  }

  async insertVersion(input: {
    report_id: string;
    version: string;
    changelog: string;
    sections_json: Record<string, unknown>;
    created_by_staff_id: number;
    status?: CsdReportStatus;
  }): Promise<CsdReportVersionRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO csd_report_versions (
           report_id, version, status, sections_json, changelog, created_by_staff_id
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.report_id,
          input.version,
          input.status ?? 'draft',
          input.sections_json,
          input.changelog,
          input.created_by_staff_id,
        ],
      );
      await client.query(
        `UPDATE csd_reports
         SET current_version = $3, updated_by_staff_id = $4, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE`,
        [CSD_TENANT_ID, input.report_id, input.version, input.created_by_staff_id],
      );
      await client.query('COMMIT');
      return mapVersion(res.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async insertSendLog(input: {
    report_id: string;
    version: string;
    to_json: string[];
    result: string;
    channel?: string;
    email_id?: string | null;
    error_text?: string | null;
    created_by_staff_id: number;
  }): Promise<CsdReportSendLogRow> {
    const res = await this.db.query(
      `INSERT INTO csd_report_send_logs (
         report_id, version, channel, to_json, result, email_id, error_text, created_by_staff_id
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.report_id,
        input.version,
        input.channel ?? 'email',
        JSON.stringify(input.to_json),
        input.result,
        input.email_id ?? null,
        input.error_text ?? null,
        input.created_by_staff_id,
      ],
    );
    return mapSendLog(res.rows[0]);
  }

  async insertSchedule(input: {
    template_id: string;
    template_code: string;
    client_account_id?: string | null;
    recurrence: 'weekly' | 'monthly' | 'quarterly';
    next_run_at: string;
    owner_staff_id: number;
    approver_staff_id?: number | null;
  }): Promise<CsdReportScheduleRow> {
    const res = await this.db.query(
      `INSERT INTO csd_report_schedules (
         tenant_id, template_id, client_account_id, recurrence, next_run_at,
         owner_staff_id, approver_staff_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        CSD_TENANT_ID,
        input.template_id,
        input.client_account_id ?? null,
        input.recurrence,
        input.next_run_at,
        input.owner_staff_id,
        input.approver_staff_id ?? null,
      ],
    );
    return mapSchedule({ ...res.rows[0], template_code: input.template_code });
  }

  async listSchedules(): Promise<CsdReportScheduleRow[]> {
    const res = await this.db.query(
      `SELECT s.*, t.code AS template_code
       FROM csd_report_schedules s
       JOIN csd_report_templates t ON t.id = s.template_id
       WHERE s.tenant_id = $1
       ORDER BY s.next_run_at ASC NULLS LAST, s.created_at DESC`,
      [CSD_TENANT_ID],
    );
    return res.rows.map((row: Record<string, unknown>) => mapSchedule(row));
  }

  async claimDueSchedules(limit = 50): Promise<CsdReportScheduleRow[]> {
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT s.*, t.code AS template_code
         FROM csd_report_schedules s
         JOIN csd_report_templates t ON t.id = s.template_id
         WHERE s.tenant_id = $1
           AND s.active = TRUE
           AND s.next_run_at <= NOW()
           AND s.recurrence IN ('weekly', 'monthly', 'quarterly')
         ORDER BY s.next_run_at ASC
         FOR UPDATE OF s SKIP LOCKED
         LIMIT $2`,
        [CSD_TENANT_ID, capped],
      );
      await client.query('COMMIT');
      return res.rows.map((row: Record<string, unknown>) => mapSchedule(row));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async bumpScheduleNextRun(id: string, recurrence: string): Promise<void> {
    await this.db.query(
      `UPDATE csd_report_schedules
          SET next_run_at = CASE $3
            WHEN 'weekly' THEN next_run_at + INTERVAL '7 days'
            WHEN 'monthly' THEN next_run_at + INTERVAL '1 month'
            WHEN 'quarterly' THEN next_run_at + INTERVAL '3 months'
            ELSE next_run_at
          END
        WHERE tenant_id = $1 AND id = $2 AND active = TRUE`,
      [CSD_TENANT_ID, id, recurrence],
    );
  }

  async upsertScheduleNextRun(input: {
    template_id: string;
    client_account_id?: string | null;
    next_run_at: string;
    owner_staff_id: number;
  }): Promise<void> {
    const updated = await this.db.query(
      `UPDATE csd_report_schedules
          SET next_run_at = $4, owner_staff_id = $5
        WHERE tenant_id = $1
          AND template_id = $2
          AND COALESCE(client_account_id, '') = COALESCE($3, '')
          AND recurrence = 'custom'
          AND active = TRUE
        RETURNING id`,
      [
        CSD_TENANT_ID,
        input.template_id,
        input.client_account_id ?? null,
        input.next_run_at,
        input.owner_staff_id,
      ],
    );
    if ((updated.rowCount ?? 0) > 0) return;
    await this.db.query(
      `INSERT INTO csd_report_schedules (
         tenant_id, template_id, client_account_id, recurrence, next_run_at, owner_staff_id
       ) VALUES ($1, $2, $3, 'custom', $4, $5)`,
      [
        CSD_TENANT_ID,
        input.template_id,
        input.client_account_id ?? null,
        input.next_run_at,
        input.owner_staff_id,
      ],
    );
  }

  async createRevisedVersion(
    reportId: string,
    nextVersion: string,
    actorStaffId: number,
    sections: Record<string, unknown>,
    changelog = 'Tạo bản sửa sau khi gửi',
  ): Promise<CsdReportRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE csd_reports
         SET current_version = $3, status = 'draft', updated_by_staff_id = $4, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND status = 'sent' AND is_deleted = FALSE`,
        [CSD_TENANT_ID, reportId, nextVersion, actorStaffId],
      );
      await client.query(
        `INSERT INTO csd_report_versions (
           report_id, version, status, sections_json, changelog, created_by_staff_id
         ) VALUES ($1, $2, 'draft', $3, $4, $5)`,
        [reportId, nextVersion, sections, changelog, actorStaffId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const report = await this.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'csd_report_not_found' });
    return report;
  }

  async insertAttachment(input: {
    id?: string;
    storage_key: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    visibility: CsdAttachmentRow['visibility'];
    entity_type: string;
    entity_id: string;
    uploaded_by_staff_id: number | null;
  }): Promise<CsdAttachmentRow> {
    const res = await this.db.query(
      `INSERT INTO csd_attachments (
         id, tenant_id, storage_key, file_name, mime_type, byte_size,
         visibility, entity_type, entity_id, uploaded_by_staff_id
       ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.id ?? null,
        CSD_TENANT_ID,
        input.storage_key,
        input.file_name,
        input.mime_type,
        input.byte_size,
        input.visibility,
        input.entity_type,
        input.entity_id,
        input.uploaded_by_staff_id,
      ],
    );
    return mapAttachment(res.rows[0]);
  }

  async countDue(): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM csd_reports r
       WHERE r.tenant_id = $1 AND r.is_deleted = FALSE
         AND r.status IN (${DUE_STATUSES_SQL})
         AND r.period_end <= CURRENT_DATE + 7`,
      [CSD_TENANT_ID],
    );
    return Number(res.rows[0]?.c ?? 0);
  }
}

export { bumpReportVersion } from './csd-report-version.util';
