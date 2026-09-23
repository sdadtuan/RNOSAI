import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { LeadFrSlaSnapshot } from './lead-fr-sla.types';

export type LeadCallAttemptRow = {
  id: number;
  lead_id: number;
  attempt_no: number;
  staff_id: number | null;
  channel: string;
  started_at: string;
  call_result: string;
  disposition: string;
  notes: string;
  duration_sec: number | null;
  counts_toward_sla: boolean;
  counts_toward_fr1: boolean;
  warn_call_too_soon: boolean;
  created_by: string;
  created_at: string;
};

function iso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class LeadFrSlaRepository implements OnModuleDestroy, OnModuleInit {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.db
        .query(`
          ALTER TABLE crm_leads
            ADD COLUMN IF NOT EXISTS first_call_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS lead_arrived_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS callback_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS meeting_place TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS info_withheld BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS hold_profile TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS previous_assignee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS sla_extend_count INT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS contact_closed_reason TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS needs_gdkd_escalate BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS fr1_due_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS fr1_breached BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS hold_reason TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS call_attempt_count INT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS attempts_since_assign INT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_call_result TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS next_call_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS is_hot BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS reassign_count INT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sla_settings_version INT;
          CREATE TABLE IF NOT EXISTS crm_lead_call_attempts (
            id                  BIGSERIAL PRIMARY KEY,
            lead_id             BIGINT NOT NULL,
            sqlite_lead_id      BIGINT NOT NULL,
            attempt_no          INT NOT NULL DEFAULT 1,
            staff_id            BIGINT,
            channel             TEXT NOT NULL DEFAULT 'phone',
            started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            call_result         TEXT NOT NULL,
            disposition         TEXT NOT NULL DEFAULT '',
            notes               TEXT NOT NULL DEFAULT '',
            duration_sec        INT,
            counts_toward_sla   BOOLEAN NOT NULL DEFAULT TRUE,
            counts_toward_fr1   BOOLEAN NOT NULL DEFAULT FALSE,
            warn_call_too_soon  BOOLEAN NOT NULL DEFAULT FALSE,
            created_by          VARCHAR(160) NOT NULL DEFAULT '',
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_crm_lead_call_attempts_lead
            ON crm_lead_call_attempts (sqlite_lead_id, started_at DESC);
        `)
        .then(() => undefined);
    }
    await this.schemaReady;
  }

  async getLeadSlaRow(leadId: number): Promise<Record<string, unknown> | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT sqlite_lead_id, owner_id, status, source,
              assigned_at, fr1_due_at, first_call_at, fr1_breached,
              hold_until, hold_reason, hold_profile, contact_status,
              call_attempt_count, attempts_since_assign,
              last_call_at, last_call_result, next_call_at,
              callback_at, meeting_at, meeting_place, info_withheld,
              is_hot, reassign_count, previous_assignee_ids,
              sla_extend_count, sla_settings_version, needs_gdkd_escalate,
              first_assigned_at, meta_json
       FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    return (result.rows[0] as Record<string, unknown>) ?? null;
  }

  async listAttempts(leadId: number, limit = 50): Promise<LeadCallAttemptRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_lead_call_attempts
       WHERE sqlite_lead_id = $1
       ORDER BY started_at DESC, id DESC
       LIMIT $2`,
      [leadId, Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows.map((r) => this.mapAttempt(r as Record<string, unknown>));
  }

  private mapAttempt(row: Record<string, unknown>): LeadCallAttemptRow {
    return {
      id: Number(row.id),
      lead_id: Number(row.sqlite_lead_id ?? row.lead_id),
      attempt_no: Number(row.attempt_no ?? 1),
      staff_id: row.staff_id != null ? Number(row.staff_id) : null,
      channel: String(row.channel ?? 'phone'),
      started_at: iso(row.started_at) ?? '',
      call_result: String(row.call_result ?? ''),
      disposition: String(row.disposition ?? ''),
      notes: String(row.notes ?? ''),
      duration_sec: row.duration_sec != null ? Number(row.duration_sec) : null,
      counts_toward_sla: row.counts_toward_sla !== false,
      counts_toward_fr1: Boolean(row.counts_toward_fr1),
      warn_call_too_soon: Boolean(row.warn_call_too_soon),
      created_by: String(row.created_by ?? ''),
      created_at: iso(row.created_at) ?? '',
    };
  }

  async insertAttempt(input: {
    leadId: number;
    attemptNo: number;
    staffId: number | null;
    channel: string;
    startedAt: Date;
    callResult: string;
    disposition: string;
    notes: string;
    durationSec: number | null;
    countsTowardSla: boolean;
    countsTowardFr1: boolean;
    warnCallTooSoon: boolean;
    createdBy: string;
  }): Promise<LeadCallAttemptRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `INSERT INTO crm_lead_call_attempts
         (lead_id, sqlite_lead_id, attempt_no, staff_id, channel, started_at,
          call_result, disposition, notes, duration_sec,
          counts_toward_sla, counts_toward_fr1, warn_call_too_soon, created_by)
       VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        input.leadId,
        input.attemptNo,
        input.staffId,
        input.channel,
        input.startedAt.toISOString(),
        input.callResult,
        input.disposition,
        input.notes,
        input.durationSec,
        input.countsTowardSla,
        input.countsTowardFr1,
        input.warnCallTooSoon,
        input.createdBy.slice(0, 160),
      ],
    );
    return this.mapAttempt(result.rows[0] as Record<string, unknown>);
  }

  async applySnapshot(
    leadId: number,
    snap: LeadFrSlaSnapshot,
    lastCallAt: Date,
    meetingPlace?: string | null,
  ): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_leads SET
         first_call_at = $2,
         fr1_breached = $3,
         hold_until = $4,
         hold_reason = $5,
         hold_profile = $6,
         contact_status = $7,
         call_attempt_count = $8,
         attempts_since_assign = $9,
         last_call_at = $10,
         last_call_result = $11,
         meeting_at = $12,
         callback_at = $13,
         info_withheld = $14,
         meeting_place = COALESCE($15, meeting_place),
         updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [
        leadId,
        snap.first_call_at?.toISOString() ?? null,
        snap.fr1_breached,
        snap.hold_until?.toISOString() ?? null,
        snap.hold_reason,
        snap.hold_profile,
        snap.contact_status,
        snap.call_attempt_count,
        snap.attempts_since_assign,
        lastCallAt.toISOString(),
        snap.last_call_result,
        snap.meeting_at?.toISOString() ?? null,
        snap.callback_at?.toISOString() ?? null,
        snap.contact_status === 'meet_pending',
        meetingPlace != null ? String(meetingPlace).slice(0, 240) : null,
      ],
    );
  }

  private async ensureReassignSchema(): Promise<void> {
    await this.ensureSchema();
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_lead_reassign_events (
        id                    BIGSERIAL PRIMARY KEY,
        sqlite_lead_id        BIGINT NOT NULL,
        from_staff_id         BIGINT,
        to_staff_id           BIGINT,
        would_to_staff_id     BIGINT,
        reason                TEXT NOT NULL DEFAULT '',
        decision              TEXT NOT NULL DEFAULT '',
        notes                 TEXT NOT NULL DEFAULT '',
        hold_until_snapshot   TIMESTAMPTZ,
        attempt_count_snapshot INT NOT NULL DEFAULT 0,
        job_run_id            TEXT NOT NULL DEFAULT '',
        dry_run               BOOLEAN NOT NULL DEFAULT TRUE,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE crm_lead_reassign_events
        ADD COLUMN IF NOT EXISTS would_to_staff_id BIGINT,
        ADD COLUMN IF NOT EXISTS decision TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_lead_reassign_job_lead
        ON crm_lead_reassign_events (job_run_id, sqlite_lead_id)
        WHERE job_run_id <> '';
      CREATE TABLE IF NOT EXISTS crm_lead_sla_job_runs (
        job_run_id   TEXT PRIMARY KEY,
        started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at  TIMESTAMPTZ,
        mode         TEXT NOT NULL DEFAULT 'dry_run',
        scanned      INT NOT NULL DEFAULT 0,
        would_reassign INT NOT NULL DEFAULT 0,
        reassigned   INT NOT NULL DEFAULT 0,
        escalated    INT NOT NULL DEFAULT 0,
        nudged       INT NOT NULL DEFAULT 0,
        queue_alerts INT NOT NULL DEFAULT 0,
        skipped      INT NOT NULL DEFAULT 0,
        detail_json  JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);
  }

  async listHoldDueLeads(now: Date, limit = 200): Promise<Record<string, unknown>[]> {
    await this.ensureReassignSchema();
    const result = await this.db.query(
      `SELECT sqlite_lead_id, owner_id, status, source,
              assigned_at, fr1_due_at, first_call_at, fr1_breached,
              hold_until, hold_reason, hold_profile, contact_status,
              call_attempt_count, attempts_since_assign,
              last_call_at, last_call_result, meeting_at, callback_at,
              is_hot, reassign_count, previous_assignee_ids,
              needs_gdkd_escalate, updated_at
       FROM crm_leads
       WHERE hold_until IS NOT NULL
         AND hold_until <= $1
         AND owner_id IS NOT NULL
         AND lower(COALESCE(contact_status, '')) NOT IN (
           'redistribute_queue', 'nurture', 'disqualified', 'unreachable_closed'
         )
       ORDER BY hold_until ASC
       LIMIT $2`,
      [now.toISOString(), Math.min(Math.max(limit, 1), 500)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async listRedistributeQueue(limit = 100): Promise<Record<string, unknown>[]> {
    await this.ensureReassignSchema();
    const result = await this.db.query(
      `SELECT sqlite_lead_id, owner_id, status, contact_status, hold_until,
              previous_assignee_ids, reassign_count, updated_at, assigned_at,
              needs_gdkd_escalate
       FROM crm_leads
       WHERE lower(COALESCE(contact_status, '')) = 'redistribute_queue'
       ORDER BY updated_at ASC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async listPoolCandidates(): Promise<
    Array<{ staff_id: number; open_attempting: number; accepts_leads: boolean; active: boolean }>
  > {
    await this.ensureReassignSchema();
    const result = await this.db.query(
      `SELECT s.id AS staff_id,
              COALESCE(s.can_receive_leads, FALSE) AS accepts_leads,
              s.active,
              COALESCE((
                SELECT COUNT(*)::int FROM crm_leads l
                WHERE l.owner_id = s.id
                  AND lower(COALESCE(l.contact_status, '')) IN
                    ('new','attempting','meet_pending','callback_scheduled')
              ), 0) AS open_attempting
       FROM crm_staff s
       WHERE s.active IS TRUE
         AND (
           COALESCE(s.can_receive_leads, FALSE) IS TRUE
           OR lower(COALESCE(s.job_title, '')) ~ '(am|account|sales|ae|kinh doanh)'
         )
       ORDER BY s.id ASC`,
    );
    return result.rows.map((r) => ({
      staff_id: Number(r.staff_id),
      open_attempting: Number(r.open_attempting ?? 0),
      accepts_leads: r.accepts_leads === true || r.accepts_leads === 1,
      active: r.active === true || r.active === 1,
    }));
  }

  async hasJobEvent(jobRunId: string, leadId: number): Promise<boolean> {
    await this.ensureReassignSchema();
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_reassign_events
       WHERE job_run_id = $1 AND sqlite_lead_id = $2 LIMIT 1`,
      [jobRunId, leadId],
    );
    return result.rows.length > 0;
  }

  async insertReassignEvent(input: {
    leadId: number;
    fromStaffId: number | null;
    toStaffId: number | null;
    wouldToStaffId: number | null;
    reason: string;
    decision: string;
    notes?: string;
    holdUntil: Date | null;
    attemptCount: number;
    jobRunId: string;
    dryRun: boolean;
  }): Promise<{ id: number; inserted: boolean }> {
    await this.ensureReassignSchema();
    try {
      const result = await this.db.query(
        `INSERT INTO crm_lead_reassign_events
           (sqlite_lead_id, from_staff_id, to_staff_id, would_to_staff_id,
            reason, decision, notes, hold_until_snapshot, attempt_count_snapshot,
            job_run_id, dry_run)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          input.leadId,
          input.fromStaffId,
          input.toStaffId,
          input.wouldToStaffId,
          input.reason.slice(0, 120),
          input.decision.slice(0, 80),
          String(input.notes ?? '').slice(0, 2000),
          input.holdUntil?.toISOString() ?? null,
          input.attemptCount,
          input.jobRunId,
          input.dryRun,
        ],
      );
      return { id: Number(result.rows[0].id), inserted: true };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') return { id: 0, inserted: false };
      throw err;
    }
  }

  async markNeedsGdkd(leadId: number, escalate: boolean): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_leads SET needs_gdkd_escalate = $2, updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId, escalate],
    );
  }

  async applyUnreachableClosed(leadId: number): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_leads SET
         contact_status = 'unreachable_closed',
         contact_closed_reason = 'max_reassign_rounds',
         hold_until = NULL,
         needs_gdkd_escalate = TRUE,
         updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId],
    );
  }

  async moveToRedistributeQueue(
    leadId: number,
    fromOwnerId: number,
    previousIds: number[],
  ): Promise<void> {
    await this.ensureSchema();
    const nextPrev = Array.from(new Set([...previousIds.map(Number), fromOwnerId]));
    await this.db.query(
      `UPDATE crm_leads SET
         previous_assignee_ids = $2::jsonb,
         owner_id = NULL,
         contact_status = 'redistribute_queue',
         reassign_count = COALESCE(reassign_count, 0) + 1,
         hold_until = NULL,
         hold_reason = 'redistribute',
         updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId, JSON.stringify(nextPrev)],
    );
  }

  async assignFromQueue(
    leadId: number,
    toOwnerId: number,
    fr1DueAt: Date,
  ): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_leads SET
         owner_id = $2,
         assigned_at = NOW(),
         fr1_due_at = $3,
         fr1_breached = FALSE,
         first_call_at = NULL,
         hold_until = NULL,
         hold_reason = '',
         hold_profile = '',
         contact_status = 'attempting',
         attempts_since_assign = 0,
         last_call_result = '',
         needs_gdkd_escalate = FALSE,
         updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId, toOwnerId, fr1DueAt.toISOString()],
    );
  }

  async startJobRun(jobRunId: string, mode: string): Promise<void> {
    await this.ensureReassignSchema();
    await this.db.query(
      `INSERT INTO crm_lead_sla_job_runs (job_run_id, mode)
       VALUES ($1, $2)
       ON CONFLICT (job_run_id) DO NOTHING`,
      [jobRunId, mode],
    );
  }

  async finishJobRun(
    jobRunId: string,
    stats: Record<string, number>,
  ): Promise<void> {
    await this.ensureReassignSchema();
    await this.db.query(
      `UPDATE crm_lead_sla_job_runs SET
         finished_at = NOW(),
         scanned = $2,
         would_reassign = $3,
         reassigned = $4,
         escalated = $5,
         nudged = $6,
         queue_alerts = $7,
         skipped = $8,
         detail_json = $9::jsonb
       WHERE job_run_id = $1`,
      [
        jobRunId,
        stats.scanned ?? 0,
        stats.would_reassign ?? 0,
        stats.reassigned ?? 0,
        stats.escalated ?? 0,
        stats.nudged ?? 0,
        stats.queue_alerts ?? 0,
        stats.skipped ?? 0,
        JSON.stringify(stats),
      ],
    );
  }

  async listReassignEvents(opts: {
    dryRun?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Record<string, unknown>[]; total: number }> {
    await this.ensureReassignSchema();
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const where =
      opts.dryRun === undefined ? '' : 'WHERE dry_run = $3';
    const params: unknown[] = [limit, offset];
    if (opts.dryRun !== undefined) params.push(opts.dryRun);
    const countSql = `SELECT COUNT(*)::int AS n FROM crm_lead_reassign_events ${
      opts.dryRun === undefined ? '' : 'WHERE dry_run = $1'
    }`;
    const count = await this.db.query(
      countSql,
      opts.dryRun === undefined ? [] : [opts.dryRun],
    );
    const result = await this.db.query(
      `SELECT e.*, l.full_name, l.status AS pipeline_stage, l.contact_status AS lead_contact_status
       FROM crm_lead_reassign_events e
       LEFT JOIN crm_leads l ON l.sqlite_lead_id = e.sqlite_lead_id
       ${where}
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT $1 OFFSET $2`,
      params,
    );
    return {
      items: result.rows as Record<string, unknown>[],
      total: Number(count.rows[0]?.n ?? 0),
    };
  }

  private deskSelectSql(): string {
    return `SELECT l.sqlite_lead_id, l.full_name, COALESCE(l.company_name, '') AS company_name,
              l.owner_id, s.name AS owner_name, l.status AS pipeline_stage,
              COALESCE(l.contact_status, '') AS contact_status,
              COALESCE(l.last_call_result, '') AS last_call_result,
              COALESCE(l.attempts_since_assign, 0) AS attempts_since_assign,
              l.fr1_due_at, l.hold_until, COALESCE(l.reassign_count, 0) AS reassign_count,
              COALESCE(l.is_hot, FALSE) AS is_hot, COALESCE(l.fr1_breached, FALSE) AS fr1_breached,
              COALESCE(l.hold_profile, '') AS hold_profile,
              COALESCE(l.hold_reason, '') AS hold_reason,
              COALESCE(l.sla_extend_count, 0) AS sla_extend_count,
              l.meeting_at, l.last_call_at, l.assigned_at, l.updated_at, l.first_call_at,
              l.previous_assignee_ids
       FROM crm_leads l
       LEFT JOIN crm_staff s ON s.id = l.owner_id`;
  }

  async listDeskFr1Breached(eligibleStages: string[], limit = 100): Promise<Record<string, unknown>[]> {
    await this.ensureSchema();
    const stages = eligibleStages.map((s) => s.toLowerCase());
    const result = await this.db.query(
      `${this.deskSelectSql()}
       WHERE l.first_call_at IS NULL
         AND l.fr1_due_at IS NOT NULL
         AND l.fr1_due_at <= NOW()
         AND l.owner_id IS NOT NULL
         AND lower(COALESCE(l.contact_status, '')) NOT IN
           ('redistribute_queue','nurture','disqualified','unreachable_closed','invalid_contact','meeting_booked')
         AND (
           COALESCE(l.status, '') = ''
           OR lower(l.status) = ANY($1::text[])
         )
       ORDER BY l.fr1_due_at ASC
       LIMIT $2`,
      [stages, Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async listDeskHoldDueSoon(
    holdHorizonIso: string,
    eligibleStages: string[],
    limit = 100,
  ): Promise<Record<string, unknown>[]> {
    await this.ensureSchema();
    const stages = eligibleStages.map((s) => s.toLowerCase());
    const result = await this.db.query(
      `${this.deskSelectSql()}
       WHERE l.hold_until IS NOT NULL
         AND l.hold_until <= $1::timestamptz
         AND l.owner_id IS NOT NULL
         AND lower(COALESCE(l.contact_status, '')) NOT IN
           ('redistribute_queue','nurture','disqualified','unreachable_closed','invalid_contact','meeting_booked')
         AND (
           COALESCE(l.status, '') = ''
           OR lower(l.status) = ANY($2::text[])
         )
       ORDER BY l.hold_until ASC
       LIMIT $3`,
      [holdHorizonIso, stages, Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async listDeskQueue(limit = 100): Promise<Record<string, unknown>[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `${this.deskSelectSql()}
       WHERE lower(COALESCE(l.contact_status, '')) = 'redistribute_queue'
       ORDER BY COALESCE(l.updated_at, l.assigned_at, NOW()) ASC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async listDeskMeetPendingLag(
    lagBeforeIso: string,
    eligibleStages: string[],
    limit = 100,
  ): Promise<Record<string, unknown>[]> {
    await this.ensureSchema();
    const stages = eligibleStages.map((s) => s.toLowerCase());
    const result = await this.db.query(
      `${this.deskSelectSql()}
       WHERE lower(COALESCE(l.contact_status, '')) = 'meet_pending'
         AND l.meeting_at IS NULL
         AND l.owner_id IS NOT NULL
         AND COALESCE(l.last_call_at, l.assigned_at, l.updated_at) <= $1::timestamptz
         AND (
           COALESCE(l.status, '') = ''
           OR lower(l.status) = ANY($2::text[])
         )
       ORDER BY COALESCE(l.last_call_at, l.assigned_at) ASC NULLS FIRST
       LIMIT $3`,
      [lagBeforeIso, stages, Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async listDeskNoTouch(
    sinceIso: string,
    eligibleStages: string[],
    limit = 100,
  ): Promise<Record<string, unknown>[]> {
    await this.ensureSchema();
    const stages = eligibleStages.map((s) => s.toLowerCase());
    const result = await this.db.query(
      `${this.deskSelectSql()}
       WHERE l.owner_id IS NOT NULL
         AND lower(COALESCE(l.contact_status, '')) IN
           ('new','attempting','callback_scheduled','meet_pending','')
         AND COALESCE(l.last_call_at, l.assigned_at, l.updated_at) <= $1::timestamptz
         AND (
           COALESCE(l.status, '') = ''
           OR lower(l.status) = ANY($2::text[])
         )
       ORDER BY COALESCE(l.last_call_at, l.assigned_at) ASC NULLS FIRST
       LIMIT $3`,
      [sinceIso, stages, Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async listRecentDryRunWouldReassign(limit = 50): Promise<Record<string, unknown>[]> {
    await this.ensureReassignSchema();
    const result = await this.db.query(
      `SELECT DISTINCT ON (e.sqlite_lead_id)
          e.sqlite_lead_id, e.would_to_staff_id, e.reason, e.decision, e.created_at AS event_at,
          l.full_name, COALESCE(l.company_name, '') AS company_name,
          l.owner_id, s.name AS owner_name, l.status AS pipeline_stage,
          COALESCE(l.contact_status, '') AS contact_status,
          COALESCE(l.last_call_result, '') AS last_call_result,
          COALESCE(l.attempts_since_assign, 0) AS attempts_since_assign,
          l.fr1_due_at, l.hold_until, COALESCE(l.reassign_count, 0) AS reassign_count,
          COALESCE(l.is_hot, FALSE) AS is_hot, COALESCE(l.fr1_breached, FALSE) AS fr1_breached,
          COALESCE(l.hold_profile, '') AS hold_profile,
          COALESCE(l.hold_reason, '') AS hold_reason,
          COALESCE(l.sla_extend_count, 0) AS sla_extend_count,
          l.meeting_at, l.last_call_at, l.assigned_at, l.updated_at
       FROM crm_lead_reassign_events e
       JOIN crm_leads l ON l.sqlite_lead_id = e.sqlite_lead_id
       LEFT JOIN crm_staff s ON s.id = l.owner_id
       WHERE e.dry_run IS TRUE
         AND e.decision = 'would_reassign'
         AND e.created_at >= NOW() - interval '7 days'
       ORDER BY e.sqlite_lead_id, e.created_at DESC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows as Record<string, unknown>[];
  }

  async frOnTimeByAm(periodStartIso: string): Promise<
    Array<{
      owner_id: number;
      owner_name: string;
      on_time: number;
      total: number;
    }>
  > {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT l.owner_id,
              COALESCE(s.name, '#' || l.owner_id::text) AS owner_name,
              COUNT(*) FILTER (
                WHERE l.first_call_at IS NOT NULL
                  AND l.fr1_due_at IS NOT NULL
                  AND l.first_call_at <= l.fr1_due_at
              )::int AS on_time,
              COUNT(*) FILTER (
                WHERE l.first_call_at IS NOT NULL AND l.fr1_due_at IS NOT NULL
              )::int AS total
       FROM crm_leads l
       LEFT JOIN crm_staff s ON s.id = l.owner_id
       WHERE l.owner_id IS NOT NULL
         AND l.first_call_at IS NOT NULL
         AND l.first_call_at >= $1::timestamptz
       GROUP BY l.owner_id, s.name
       HAVING COUNT(*) FILTER (
         WHERE l.first_call_at IS NOT NULL AND l.fr1_due_at IS NOT NULL
       ) > 0
       ORDER BY total DESC, owner_name ASC
       LIMIT 40`,
      [periodStartIso],
    );
    return result.rows.map((r) => ({
      owner_id: Number(r.owner_id),
      owner_name: String(r.owner_name ?? ''),
      on_time: Number(r.on_time ?? 0),
      total: Number(r.total ?? 0),
    }));
  }

  async getLeadDeskRow(leadId: number): Promise<Record<string, unknown> | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `${this.deskSelectSql()} WHERE l.sqlite_lead_id = $1 LIMIT 1`,
      [leadId],
    );
    return (result.rows[0] as Record<string, unknown>) ?? null;
  }

  async extendHoldUntil(
    leadId: number,
    newHoldUntil: Date,
    maxExtends: number,
  ): Promise<{ ok: boolean; error?: string; extend_count?: number }> {
    await this.ensureSchema();
    const result = await this.db.query(
      `UPDATE crm_leads SET
         hold_until = $2,
         hold_reason = 'manual_extend',
         sla_extend_count = COALESCE(sla_extend_count, 0) + 1,
         updated_at = NOW()
       WHERE sqlite_lead_id = $1
         AND COALESCE(sla_extend_count, 0) < $3
         AND (
           lower(COALESCE(hold_profile, '')) = '1b'
           OR hold_reason IN ('fr_chain_1b', 'hot_lead')
           OR lower(COALESCE(last_call_result, '')) = 'ring_no_answer'
         )
       RETURNING sla_extend_count`,
      [leadId, newHoldUntil.toISOString(), maxExtends],
    );
    if (!result.rows.length) {
      return { ok: false, error: 'extend_not_allowed' };
    }
    return { ok: true, extend_count: Number(result.rows[0].sla_extend_count) };
  }

  async markInvalid(leadId: number, notes: string): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_leads SET
         contact_status = 'invalid_contact',
         last_call_result = 'wrong_number',
         hold_until = NULL,
         hold_reason = 'wrong_number',
         hold_profile = 'invalid',
         contact_closed_reason = LEFT($2, 240),
         needs_gdkd_escalate = FALSE,
         updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId, notes || 'gdkd_mark_invalid'],
    );
  }

  async clearFr1BreachOnReassign(leadId: number): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_leads SET fr1_breached = FALSE, needs_gdkd_escalate = FALSE, updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId],
    );
  }
}
