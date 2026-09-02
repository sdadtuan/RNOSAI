import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CSD_TENANT_ID,
  CsdReportListQuery,
  CsdReportRow,
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

function mapSendLog(row: Record<string, unknown>): CsdReportSendLogRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    version: text(row.version),
    channel: text(row.channel),
    to_json: (row.to_json as string[]) ?? [],
    result: text(row.result),
    email_id: row.email_id != null ? text(row.email_id) : null,
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
       ORDER BY v.created_at ASC, v.version ASC`,
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

  async insertSendLog(input: {
    report_id: string;
    version: string;
    to_json: string[];
    result: string;
    email_id?: string | null;
    created_by_staff_id: number;
  }): Promise<CsdReportSendLogRow> {
    const res = await this.db.query(
      `INSERT INTO csd_report_send_logs (
         report_id, version, channel, to_json, result, email_id, created_by_staff_id
       ) VALUES ($1, $2, 'email', $3::jsonb, $4, $5, $6)
       RETURNING *`,
      [
        input.report_id,
        input.version,
        JSON.stringify(input.to_json),
        input.result,
        input.email_id ?? null,
        input.created_by_staff_id,
      ],
    );
    return mapSendLog(res.rows[0]);
  }

  async createRevisedVersion(
    reportId: string,
    nextVersion: string,
    actorStaffId: number,
    sections: Record<string, unknown>,
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
         ) VALUES ($1, $2, 'draft', $3, 'Revised after send', $4)`,
        [reportId, nextVersion, sections, actorStaffId],
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
