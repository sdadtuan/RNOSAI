import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { IWR_TENANT_ID, type IwrDashRole, type IwrScheduleRow } from './iwr.types';

function text(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

@Injectable()
export class IwrScheduleRepository implements OnModuleDestroy {
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

  async listSchedules(): Promise<IwrScheduleRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_schedules WHERE tenant_id = $1 ORDER BY kind`,
      [IWR_TENANT_ID],
    );
    return res.rows.map((r) => ({
      id: text(r.id),
      kind: text(r.kind) as IwrScheduleRow['kind'],
      cron_expr: text(r.cron_expr),
      timezone: text(r.timezone),
      channel: 'in_app',
      active: Boolean(r.active),
      next_run_at: r.next_run_at != null ? text(r.next_run_at) : null,
    }));
  }

  async claimDueSchedules(limit = 10): Promise<IwrScheduleRow[]> {
    const res = await this.db.query(
      `WITH due AS (
         SELECT * FROM iwr_schedules
          WHERE tenant_id = $1 AND active = TRUE AND next_run_at <= NOW()
          ORDER BY next_run_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       ),
       bumped AS (
         UPDATE iwr_schedules s
            SET next_run_at = CASE due.kind
              WHEN 'reminder' THEN NOW() + INTERVAL '1 hour'
              ELSE NOW() + INTERVAL '1 day'
            END,
            updated_at = NOW()
           FROM due
          WHERE s.id = due.id
         RETURNING s.id
       )
       SELECT due.* FROM due JOIN bumped ON bumped.id = due.id`,
      [IWR_TENANT_ID, limit],
    );
    return res.rows.map((r) => ({
      id: text(r.id),
      kind: text(r.kind) as IwrScheduleRow['kind'],
      cron_expr: text(r.cron_expr),
      timezone: text(r.timezone),
      channel: 'in_app',
      active: Boolean(r.active),
      next_run_at: r.next_run_at != null ? text(r.next_run_at) : null,
    }));
  }

  async tryInsertJob(eventKey: string, kind: string, payload: Record<string, unknown>): Promise<boolean> {
    const res = await this.db.query(
      `INSERT INTO iwr_jobs (tenant_id, event_key, kind, payload_json)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (tenant_id, event_key) DO NOTHING
       RETURNING id`,
      [IWR_TENANT_ID, eventKey, kind, JSON.stringify(payload)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listActiveStaffWithManager(): Promise<{ id: number; reports_to_id: number | null }[]> {
    const res = await this.db.query(
      `SELECT id, reports_to_id FROM crm_staff WHERE active = TRUE AND reports_to_id IS NOT NULL`,
    );
    return res.rows.map((r) => ({ id: Number(r.id), reports_to_id: r.reports_to_id != null ? Number(r.reports_to_id) : null }));
  }

  async findDailyDraft(authorId: number, ymd: string): Promise<string | null> {
    const res = await this.db.query(
      `SELECT r.id FROM iwr_reports r
        JOIN iwr_templates t ON t.id = r.template_id
       WHERE r.tenant_id = $1 AND r.author_staff_id = $2
         AND t.code = 'daily_work'
         AND r.period_start = $3::date AND r.period_end = $3::date
         AND r.is_deleted = FALSE
       LIMIT 1`,
      [IWR_TENANT_ID, authorId, ymd],
    );
    return res.rows[0] ? text(res.rows[0].id) : null;
  }

  async getDailyTemplateId(): Promise<string | null> {
    const res = await this.db.query(
      `SELECT id FROM iwr_templates WHERE tenant_id = $1 AND code = 'daily_work' AND active = TRUE LIMIT 1`,
      [IWR_TENANT_ID],
    );
    return res.rows[0] ? text(res.rows[0].id) : null;
  }

  async insertDraftDaily(input: {
    template_id: string;
    author_staff_id: number;
    reviewer_staff_id: number;
    ymd: string;
    title: string;
    due_at: string;
  }): Promise<string> {
    const res = await this.db.query(
      `INSERT INTO iwr_reports (
         tenant_id, template_id, title, author_staff_id, reviewer_staff_id,
         period_start, period_end, due_at, sections_json, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, '{}', 'draft')
       RETURNING id`,
      [
        IWR_TENANT_ID,
        input.template_id,
        input.title,
        input.author_staff_id,
        input.reviewer_staff_id,
        input.ymd,
        input.due_at,
      ],
    );
    return text(res.rows[0].id);
  }

  async leaderDigestCounts(leaderId: number, ymd: string): Promise<{ missing: number; blockers: number; action: number }> {
    const res = await this.db.query(
      `WITH team AS (
         SELECT id FROM crm_staff WHERE active = TRUE AND reports_to_id = $2
       ),
       today AS (
         SELECT r.*, t.code AS template_code, a.name AS author_name
           FROM iwr_reports r
           JOIN iwr_templates t ON t.id = r.template_id
           JOIN crm_staff a ON a.id = r.author_staff_id
          WHERE r.tenant_id = $1 AND r.period_start = $3::date AND r.is_deleted = FALSE
            AND t.code = 'daily_work' AND r.author_staff_id IN (SELECT id FROM team)
       )
       SELECT
         (SELECT COUNT(*) FROM team t WHERE NOT EXISTS (
           SELECT 1 FROM today r WHERE r.author_staff_id = t.id AND r.status NOT IN ('draft','waived')
         ))::int AS missing,
         (SELECT COUNT(DISTINCT rk.report_id)::int FROM iwr_risks rk
           JOIN today r ON r.id = rk.report_id
          WHERE rk.status <> 'closed') AS blockers,
         (SELECT COUNT(*)::int FROM today r
           WHERE r.reviewer_staff_id = $2 AND r.status IN ('submitted','supplemented')) AS action`,
      [IWR_TENANT_ID, leaderId, ymd],
    );
    const row = res.rows[0] ?? {};
    return {
      missing: Number(row.missing ?? 0),
      blockers: Number(row.blockers ?? 0),
      action: Number(row.action ?? 0),
    };
  }

  async listManagers(): Promise<number[]> {
    const res = await this.db.query(
      `SELECT DISTINCT reports_to_id AS id FROM crm_staff WHERE active = TRUE AND reports_to_id IS NOT NULL`,
    );
    return res.rows.map((r) => Number(r.id)).filter((n) => n > 0);
  }
}

@Injectable()
export class IwrDashSnapshotsRepository implements OnModuleDestroy {
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

  async getSnapshot(role: IwrDashRole, ymd: string): Promise<{ payload: unknown; computed_at: string } | null> {
    const res = await this.db.query(
      `SELECT payload_json, computed_at FROM iwr_dash_snapshots
        WHERE tenant_id = $1 AND role = $2 AND period_ymd = $3::date
        LIMIT 1`,
      [IWR_TENANT_ID, role, ymd],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { payload: row.payload_json, computed_at: text(row.computed_at) };
  }

  async upsertSnapshot(role: IwrDashRole, ymd: string, payload: unknown): Promise<void> {
    await this.db.query(
      `INSERT INTO iwr_dash_snapshots (tenant_id, role, period_ymd, payload_json, computed_at)
       VALUES ($1, $2, $3::date, $4::jsonb, NOW())
       ON CONFLICT (tenant_id, role, period_ymd)
       DO UPDATE SET payload_json = EXCLUDED.payload_json, computed_at = NOW()`,
      [IWR_TENANT_ID, role, ymd, JSON.stringify(payload)],
    );
  }

  async countUnread(staffId: number): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM csd_notifications
        WHERE tenant_id = $1 AND staff_id = $2 AND read_at IS NULL`,
      [IWR_TENANT_ID, staffId],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async staffMetrics(staffId: number, ymd: string): Promise<{
    due_today: boolean;
    late_num: number;
    late_den: number;
    open_blockers: number;
  }> {
    const res = await this.db.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM iwr_reports r
           JOIN iwr_templates t ON t.id = r.template_id
           WHERE r.author_staff_id = $2 AND r.tenant_id = $1
             AND t.code = 'daily_work' AND r.period_start = $3::date
             AND r.is_deleted = FALSE AND r.status IN ('draft','changes_requested')
         ) AS due_today,
         (SELECT COUNT(*)::int FROM iwr_reports r
           WHERE r.author_staff_id = $2 AND r.tenant_id = $1
             AND r.is_late = TRUE AND r.submitted_at >= NOW() - INTERVAL '30 days'
             AND r.is_deleted = FALSE) AS late_num,
         (SELECT COUNT(*)::int FROM iwr_reports r
           WHERE r.author_staff_id = $2 AND r.tenant_id = $1
             AND r.status NOT IN ('draft','waived') AND r.submitted_at >= NOW() - INTERVAL '30 days'
             AND r.is_deleted = FALSE) AS late_den,
         (SELECT COUNT(*)::int FROM iwr_risks rk
           WHERE rk.tenant_id = $1 AND rk.status <> 'closed'
             AND (rk.owner_staff_id = $2 OR EXISTS (
               SELECT 1 FROM iwr_reports r WHERE r.id = rk.report_id AND r.author_staff_id = $2
             ))) AS open_blockers`,
      [IWR_TENANT_ID, staffId, ymd],
    );
    const row = res.rows[0] ?? {};
    return {
      due_today: Boolean(row.due_today),
      late_num: Number(row.late_num ?? 0),
      late_den: Number(row.late_den ?? 0),
      open_blockers: Number(row.open_blockers ?? 0),
    };
  }

  async leaderMetrics(leaderId: number, ymd: string): Promise<Omit<import('./iwr.types').IwrDashLeader, never>> {
    const res = await this.db.query(
      `WITH team AS (SELECT id FROM crm_staff WHERE active = TRUE AND reports_to_id = $2),
       reports AS (
         SELECT r.*, t.code AS template_code
           FROM iwr_reports r
           JOIN iwr_templates t ON t.id = r.template_id
          WHERE r.tenant_id = $1 AND r.period_start = $3::date AND r.is_deleted = FALSE
            AND t.code = 'daily_work' AND r.author_staff_id IN (SELECT id FROM team)
       )
       SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('draft','waived'))::int AS submitted,
         ((SELECT COUNT(*) FROM team) - COUNT(*) FILTER (WHERE status NOT IN ('draft','waived')))::int AS missing,
         COUNT(*) FILTER (WHERE is_late = TRUE)::int AS late,
         COUNT(*) FILTER (WHERE reviewer_staff_id = $2 AND status IN ('submitted','supplemented'))::int AS action_needed,
         COUNT(*) FILTER (WHERE rag = 'red')::int AS rag_red,
         (SELECT COUNT(DISTINCT rk.report_id)::int FROM iwr_risks rk
           JOIN reports r ON r.id = rk.report_id WHERE rk.status <> 'closed') AS open_blockers
       FROM reports`,
      [IWR_TENANT_ID, leaderId, ymd],
    );
    const row = res.rows[0] ?? {};
    return {
      submitted: Number(row.submitted ?? 0),
      missing: Math.max(0, Number(row.missing ?? 0)),
      late: Number(row.late ?? 0),
      action_needed: Number(row.action_needed ?? 0),
      rag_red: Number(row.rag_red ?? 0),
      open_blockers: Number(row.open_blockers ?? 0),
    };
  }

  async pmMetrics(staffId: number): Promise<import('./iwr.types').IwrDashPm> {
    const res = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('on_hold','waiting_for_internal_approval') AND is_deleted = FALSE)::int AS client_blockers,
         COUNT(*) FILTER (WHERE sla_status <> 'on_track' AND status NOT IN ('closed','cancelled') AND is_deleted = FALSE)::int AS unread_over_sla,
         COUNT(*) FILTER (WHERE due_at < NOW() AND status NOT IN ('closed','cancelled','resolved') AND is_deleted = FALSE)::int AS overdue_tickets
       FROM csd_tickets
       WHERE tenant_id = $1 AND (assignee_staff_id = $2 OR owner_staff_id = $2)`,
      [IWR_TENANT_ID, staffId],
    );
    const row = res.rows[0] ?? {};
    return {
      client_blockers: Number(row.client_blockers ?? 0),
      unread_over_sla: Number(row.unread_over_sla ?? 0),
      overdue_tickets: Number(row.overdue_tickets ?? 0),
    };
  }

  async bodMetrics(ymd: string): Promise<import('./iwr.types').IwrDashBod> {
    const res = await this.db.query(
      `WITH active_staff AS (SELECT id FROM crm_staff WHERE active = TRUE),
       today AS (
         SELECT r.*, a.name AS author_name
           FROM iwr_reports r
           JOIN iwr_templates t ON t.id = r.template_id
           JOIN crm_staff a ON a.id = r.author_staff_id
          WHERE r.tenant_id = $1 AND r.period_start = $2::date AND r.is_deleted = FALSE
            AND t.code = 'daily_work'
       ),
       submitted AS (SELECT COUNT(DISTINCT author_staff_id)::int AS n FROM today WHERE status NOT IN ('draft','waived')),
       total AS (SELECT COUNT(*)::int AS n FROM active_staff)
       SELECT
         CASE WHEN (SELECT n FROM total) > 0
           THEN ROUND((SELECT n FROM submitted)::numeric / (SELECT n FROM total), 4)
           ELSE 0 END AS submit_rate,
         (SELECT COUNT(*)::int FROM iwr_risks WHERE tenant_id = $1 AND severity = 'critical' AND status <> 'closed') AS critical_risks,
         (SELECT COUNT(*)::int FROM today WHERE status IN ('submitted','supplemented') AND acknowledged_at IS NULL) AS pending_acks`,
      [IWR_TENANT_ID, ymd],
    );
    const ragRes = await this.db.query(
      `SELECT r.id AS report_id, a.name AS author_name
         FROM iwr_reports r
         JOIN iwr_templates t ON t.id = r.template_id
         JOIN crm_staff a ON a.id = r.author_staff_id
        WHERE r.tenant_id = $1 AND r.period_start = $2::date
          AND r.rag = 'red' AND r.is_deleted = FALSE
        ORDER BY a.name LIMIT 20`,
      [IWR_TENANT_ID, ymd],
    );
    const row = res.rows[0] ?? {};
    return {
      submit_rate: Number(row.submit_rate ?? 0),
      rag_red_list: ragRes.rows.map((r) => ({
        report_id: text(r.report_id),
        author_name: text(r.author_name),
      })),
      critical_risks: Number(row.critical_risks ?? 0),
      pending_acks: Number(row.pending_acks ?? 0),
    };
  }
}

@Injectable()
export class IwrDelegationsRepository implements OnModuleDestroy {
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

  async isDelegateFor(delegatorStaffId: number, delegateStaffId: number, at: Date): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM iwr_delegations
        WHERE tenant_id = $1 AND active = TRUE
          AND delegator_staff_id = $2 AND delegate_staff_id = $3
          AND starts_at <= $4 AND ends_at >= $4
        LIMIT 1`,
      [IWR_TENANT_ID, delegatorStaffId, delegateStaffId, at.toISOString()],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async list(): Promise<import('./iwr.types').IwrDelegationRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_delegations WHERE tenant_id = $1 ORDER BY starts_at DESC LIMIT 200`,
      [IWR_TENANT_ID],
    );
    return res.rows.map((r) => ({
      id: text(r.id),
      delegator_staff_id: Number(r.delegator_staff_id),
      delegate_staff_id: Number(r.delegate_staff_id),
      starts_at: text(r.starts_at),
      ends_at: text(r.ends_at),
      active: Boolean(r.active),
    }));
  }

  async insert(input: {
    delegator_staff_id: number;
    delegate_staff_id: number;
    starts_at: string;
    ends_at: string;
  }): Promise<import('./iwr.types').IwrDelegationRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_delegations (tenant_id, delegator_staff_id, delegate_staff_id, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [IWR_TENANT_ID, input.delegator_staff_id, input.delegate_staff_id, input.starts_at, input.ends_at],
    );
    const r = res.rows[0];
    return {
      id: text(r.id),
      delegator_staff_id: Number(r.delegator_staff_id),
      delegate_staff_id: Number(r.delegate_staff_id),
      starts_at: text(r.starts_at),
      ends_at: text(r.ends_at),
      active: Boolean(r.active),
    };
  }
}
