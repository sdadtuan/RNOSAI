import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { IWR_TENANT_ID, type IwrCommentRow, type IwrDeliveryLogRow, type IwrRiskRow } from './iwr.types';

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

function mapDeliveryLog(row: Record<string, unknown>): IwrDeliveryLogRow {
  return {
    id: text(row.id),
    report_id: text(row.report_id),
    distribution_id: row.distribution_id != null ? text(row.distribution_id) : null,
    channel: text(row.channel),
    status: text(row.status),
    to_snapshot: Array.isArray(row.to_snapshot) ? row.to_snapshot.map(Number) : [],
    cc_snapshot: Array.isArray(row.cc_snapshot) ? row.cc_snapshot.map(Number) : [],
    bcc_snapshot: Array.isArray(row.bcc_snapshot) ? row.bcc_snapshot.map(Number) : [],
    created_at: text(row.created_at),
  };
}

function mapRisk(row: Record<string, unknown>): IwrRiskRow {
  return {
    id: text(row.id),
    report_id: row.report_id != null ? text(row.report_id) : null,
    item_id: row.item_id != null ? text(row.item_id) : null,
    title: text(row.title),
    severity: text(row.severity) as IwrRiskRow['severity'],
    owner_staff_id: num(row.owner_staff_id),
    status: text(row.status) as IwrRiskRow['status'],
    due_at: row.due_at != null ? text(row.due_at) : null,
  };
}

@Injectable()
export class IwrDistributionRepository implements OnModuleDestroy {
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

  async insertDistribution(input: {
    report_id: string;
    thread_id?: string | null;
    kind: 'reply' | 'reply_all' | 'forward';
    from_staff_id: number;
    note_text?: string | null;
  }): Promise<string> {
    const res = await this.db.query(
      `INSERT INTO iwr_distributions (report_id, thread_id, kind, from_staff_id, note_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.report_id, input.thread_id ?? null, input.kind, input.from_staff_id, input.note_text ?? null],
    );
    return text(res.rows[0].id);
  }

  async insertDeliveryLog(input: {
    report_id: string;
    distribution_id?: string | null;
    to_snapshot: number[];
    cc_snapshot: number[];
    bcc_snapshot: number[];
  }): Promise<IwrDeliveryLogRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_delivery_logs (
         report_id, distribution_id, channel, status, to_snapshot, cc_snapshot, bcc_snapshot
       ) VALUES ($1, $2, 'in_app', 'delivered', $3::jsonb, $4::jsonb, $5::jsonb)
       RETURNING *`,
      [
        input.report_id,
        input.distribution_id ?? null,
        JSON.stringify(input.to_snapshot),
        JSON.stringify(input.cc_snapshot),
        JSON.stringify(input.bcc_snapshot),
      ],
    );
    return mapDeliveryLog(res.rows[0]);
  }

  async listDeliveryLogs(reportId: string): Promise<IwrDeliveryLogRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_delivery_logs WHERE report_id = $1 ORDER BY created_at DESC`,
      [reportId],
    );
    return res.rows.map(mapDeliveryLog);
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

  async insertMentions(reportId: string, commentId: string, staffIds: number[]): Promise<void> {
    for (const staffId of staffIds) {
      await this.db.query(
        `INSERT INTO iwr_mentions (report_id, comment_id, staff_id) VALUES ($1, $2, $3)`,
        [reportId, commentId, staffId],
      );
    }
  }
}

@Injectable()
export class IwrRisksRepository implements OnModuleDestroy {
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

  async listOpen(tenantId = IWR_TENANT_ID): Promise<IwrRiskRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_risks
        WHERE tenant_id = $1 AND status <> 'closed'
        ORDER BY created_at DESC
        LIMIT 200`,
      [tenantId],
    );
    return res.rows.map(mapRisk);
  }

  async getById(id: string): Promise<IwrRiskRow | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_risks WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [IWR_TENANT_ID, id],
    );
    return res.rows[0] ? mapRisk(res.rows[0]) : null;
  }

  async insert(input: {
    report_id: string | null;
    item_id: string | null;
    title: string;
    severity: IwrRiskRow['severity'];
    owner_staff_id: number | null;
    due_at?: string | null;
  }): Promise<IwrRiskRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_risks (tenant_id, report_id, item_id, title, severity, owner_staff_id, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        IWR_TENANT_ID,
        input.report_id,
        input.item_id,
        input.title,
        input.severity,
        input.owner_staff_id,
        input.due_at ?? null,
      ],
    );
    return mapRisk(res.rows[0]);
  }

  async updateStatus(id: string, status: IwrRiskRow['status'], ownerStaffId?: number | null): Promise<IwrRiskRow | null> {
    const sets = ['status = $3', 'updated_at = NOW()'];
    const params: unknown[] = [IWR_TENANT_ID, id, status];
    if (ownerStaffId !== undefined) {
      sets.push('owner_staff_id = $4');
      params.push(ownerStaffId);
    }
    const res = await this.db.query(
      `UPDATE iwr_risks SET ${sets.join(', ')}
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      params,
    );
    return res.rows[0] ? mapRisk(res.rows[0]) : null;
  }

  async listReportIdsWithOpenRisks(staffId: number): Promise<string[]> {
    const res = await this.db.query(
      `SELECT DISTINCT r.report_id
         FROM iwr_risks r
         LEFT JOIN iwr_reports rep ON rep.id = r.report_id
        WHERE r.tenant_id = $1
          AND r.status <> 'closed'
          AND r.report_id IS NOT NULL
          AND (
            r.owner_staff_id = $2
            OR rep.author_staff_id = $2
            OR rep.reviewer_staff_id = $2
            OR EXISTS (
              SELECT 1 FROM iwr_report_recipients rec
               WHERE rec.report_id = r.report_id AND rec.staff_id = $2
            )
          )`,
      [IWR_TENANT_ID, staffId],
    );
    return res.rows.map((row) => text(row.report_id));
  }
}
