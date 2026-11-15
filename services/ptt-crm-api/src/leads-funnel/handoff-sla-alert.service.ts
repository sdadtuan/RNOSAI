import { Injectable, Logger, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { buildHandoffSlaView, inferHandoffSlaStep, resolveHandoffSlaRecipientIds, slaNotifyCopy, type HandoffSlaClock } from './handoff-sla.util';
import { currentSolutionWorkSettings } from './team-sla-solution-settings';

/** Rows per keyset page. */
export const HANDOFF_SLA_SCAN_BATCH = 200;
/** Hard cap on pages per tick (bounded loop): 50 x 200 = 10k open presales rows. */
export const HANDOFF_SLA_SCAN_MAX_BATCHES = 50;
/** Largest warn window of any clock (contract = 8h) so warnings are still picked up in SQL. */
export const HANDOFF_SLA_SCAN_WINDOW_HOURS = 8;
/** Longest derived clock (contract 5 business days + weekend/off-hours slack). */
export const HANDOFF_SLA_DERIVED_LOOKBACK_DAYS = 10;
/** Failed deliveries per alert before the worker gives up on it (until the process restarts). */
export const HANDOFF_SLA_ALERT_MAX_ATTEMPTS = 5;
/** First retry wait; doubles per failure. */
export const HANDOFF_SLA_ALERT_BACKOFF_BASE_MINUTES = 1;
export const HANDOFF_SLA_ALERT_BACKOFF_MAX_MINUTES = 60;
/** Bound on remembered failing alerts (oldest dropped first). */
const HANDOFF_SLA_ALERT_RETRY_CAP = 5000;

/** Minutes to wait before retrying after the n-th failed delivery (1, 2, 4, 8 ... capped at 60). */
export function handoffSlaRetryDelayMinutes(failures: number): number {
  const n = Math.max(1, Math.floor(failures));
  return Math.min(HANDOFF_SLA_ALERT_BACKOFF_MAX_MINUTES, HANDOFF_SLA_ALERT_BACKOFF_BASE_MINUTES * 2 ** (n - 1));
}

/** Lead statuses that never raise handoff SLA alerts. */
export const HANDOFF_SLA_EXCLUDED_LEAD_STATUSES = [
  'lost',
  'mat',
  'huy',
  'cancelled',
  'won',
  'converted',
  'closed',
  'pending_cleanup',
] as const;

/**
 * Go-live cutoff: only clocks due at/after this moment alert.
 * PTT_HANDOFF_SLA_ALERT_SINCE (ISO) wins; otherwise the process start (deploy time).
 */
export function resolveHandoffSlaAlertSince(
  env: NodeJS.ProcessEnv = process.env,
  fallback: Date = new Date(),
): Date {
  const raw = String(env.PTT_HANDOFF_SLA_ALERT_SINCE ?? '').trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(fallback.getTime());
}

/** Worker is off unless explicitly enabled (PTT_HANDOFF_SLA_ALERT_WORKER=1/true/on). */
export function isHandoffSlaAlertWorkerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.PTT_HANDOFF_SLA_ALERT_WORKER ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

/** True when a warning/breach clock is after the go-live cutoff and should alert. */
export function isAlertableClock(clock: Pick<HandoffSlaClock, 'state' | 'due_at'>, since: Date): boolean {
  if (clock.state !== 'warning' && clock.state !== 'breach') return false;
  if (!clock.due_at) return false;
  const due = new Date(clock.due_at);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() >= since.getTime();
}

export type HandoffSlaTickResult = {
  scanned: number;
  sent: number;
  skipped_no_recipient: number;
  failed: number;
  /** Skipped this tick because an earlier delivery failed (backoff) or retries ran out. */
  deferred: number;
  batches: number;
};

@Injectable()
export class HandoffSlaAlertService {
  private readonly logger = new Logger(HandoffSlaAlertService.name);

  private pool: Pool | null = null;
  private ensured: Promise<void> | null = null;
  private readonly since: Date;
  /** In-memory retry state per alert (lead|clock|state|due). */
  private readonly retries = new Map<string, { failures: number; nextAt: number }>();

  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly notifications?: StaffNotificationsRepository,
  ) {
    this.since = resolveHandoffSlaAlertSince();
  }

  get alertSince(): Date {
    return new Date(this.since.getTime());
  }

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  /** DDL runs once per process (memoized); a failure clears the memo so the next tick retries. */
  ensureTable(): Promise<void> {
    if (!this.ensured) {
      this.ensured = this.runDdl().catch((err) => {
        this.ensured = null;
        throw err;
      });
    }
    return this.ensured;
  }

  private async runDdl(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_handoff_sla_alerts (
        id          BIGSERIAL PRIMARY KEY,
        lead_id     BIGINT NOT NULL,
        clock_key   TEXT NOT NULL,
        state       TEXT NOT NULL,
        due_at      TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00',
        sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_handoff_sla_alerts_uq UNIQUE (lead_id, clock_key, state)
      )
    `);
    await this.db.query(`
      ALTER TABLE crm_handoff_sla_alerts
        ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00'
    `);
    // Additive: keep crm_handoff_sla_alerts_uq. Only a DB that ran the earlier draft (constraint
    // dropped) gets a replacement unique index on the same columns.
    await this.db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_index i
            JOIN pg_class t ON t.oid = i.indrelid
           WHERE t.relname = 'crm_handoff_sla_alerts'
             AND i.indisunique
             AND pg_get_indexdef(i.indexrelid) LIKE '%(lead_id, clock_key, state)'
        ) THEN
          DELETE FROM crm_handoff_sla_alerts a
           USING crm_handoff_sla_alerts b
           WHERE a.lead_id = b.lead_id AND a.clock_key = b.clock_key AND a.state = b.state AND a.id < b.id;
          CREATE UNIQUE INDEX IF NOT EXISTS crm_handoff_sla_alerts_lcs_uq
            ON crm_handoff_sla_alerts (lead_id, clock_key, state);
        END IF;
      END $$
    `);
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_handoff_sla_alerts_sent
        ON crm_handoff_sla_alerts (sent_at DESC)
    `);
    await this.db.query(`
      ALTER TABLE crm_lead_presales
        ADD COLUMN IF NOT EXISTS brief_entered_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS brief_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS negotiate_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS contract_due_at TIMESTAMPTZ
    `);
  }

  /**
   * Candidate rows: open presales whose stored due columns fall inside [since, now + window),
   * or whose derived clocks (accept / first update / brief / CEO / negotiate / contract) started
   * recently enough to still be due after the cutoff. Keyset-paginated by presales id.
   */
  private async loadBatch(afterId: number, now: Date): Promise<Array<Record<string, unknown>>> {
    const { rows } = await this.db.query(
      `
      SELECT ps.id AS presales_id,
             l.sqlite_lead_id AS lead_id,
             l.status,
             l.owner_id,
             l.assigned_at,
             (SELECT MIN(a.created_at)
                FROM crm_lead_activities a
               WHERE a.lead_id = l.sqlite_lead_id
                 AND a.activity_type = 'call') AS first_call_at,
             ps.stage,
             ps.handoff_status,
             ps.handed_off_at,
             ps.handed_off_by_staff_id,
             ps.brief_entered_at,
             ps.brief_due_at,
             ps.missing_info_due_at,
             ps.solution_accept_due_at,
             ps.solution_claimed_at,
             ps.solution_due_at,
             ps.solution_revision_due_at,
             ps.solution_released_at,
             ps.solution_customer_due_at,
             ps.solution_owner_staff_id,
             ps.last_solution_owner_staff_id,
             ps.quote_offered_at,
             ps.quote_accept_due_at,
             ps.quote_accepted_at,
             ps.quote_due_at,
             ps.quote_sent_back_at,
             ps.quote_approved_at,
             ps.quote_assignee_staff_id,
             ps.quote_ceo_escalated_at,
             ps.implementation_status,
             ps.negotiate_due_at,
             ps.contract_due_at,
             ps.contract_signed_at,
             l.sales_claimed_at
        FROM crm_lead_presales ps
        JOIN crm_leads l ON l.sqlite_lead_id = ps.lead_id
       WHERE ps.id > $1
         AND ps.contract_signed_at IS NULL
         AND lower(COALESCE(l.status, '')) <> ALL($2::text[])
         AND (
           (
             LEAST(ps.brief_due_at, ps.missing_info_due_at, ps.solution_accept_due_at, ps.solution_due_at,
                   ps.solution_revision_due_at, ps.solution_customer_due_at, ps.quote_accept_due_at,
                   ps.quote_due_at, ps.negotiate_due_at, ps.contract_due_at)
               < $3::timestamptz + ($4::int * INTERVAL '1 hour')
             AND GREATEST(ps.brief_due_at, ps.missing_info_due_at, ps.solution_accept_due_at, ps.solution_due_at,
                   ps.solution_revision_due_at, ps.solution_customer_due_at, ps.quote_accept_due_at,
                   ps.quote_due_at, ps.negotiate_due_at, ps.contract_due_at)
               >= $5::timestamptz
           )
           OR (
             GREATEST(l.assigned_at, l.sales_claimed_at, ps.brief_entered_at, ps.quote_sent_back_at, ps.quote_approved_at)
               >= $5::timestamptz - ($6::int * INTERVAL '1 day')
           )
         )
       ORDER BY ps.id ASC
       LIMIT $7
      `,
      [
        afterId,
        [...HANDOFF_SLA_EXCLUDED_LEAD_STATUSES],
        now.toISOString(),
        HANDOFF_SLA_SCAN_WINDOW_HOURS,
        this.since.toISOString(),
        HANDOFF_SLA_DERIVED_LOOKBACK_DAYS,
        HANDOFF_SLA_SCAN_BATCH,
      ],
    );
    return rows as Array<Record<string, unknown>>;
  }

  async tick(now = new Date()): Promise<HandoffSlaTickResult> {
    await this.ensureTable();
    const workSettings = currentSolutionWorkSettings();
    const [amDeskStaffIds, ceoDeskStaffIds, superAdminStaffIds] = await Promise.all([
      this.amDeskStaffIds(),
      this.ceoDeskStaffIds(),
      this.superAdminStaffIds(),
    ]);

    const result: HandoffSlaTickResult = {
      scanned: 0,
      sent: 0,
      skipped_no_recipient: 0,
      failed: 0,
      deferred: 0,
      batches: 0,
    };
    let afterId = 0;
    for (let batch = 0; batch < HANDOFF_SLA_SCAN_MAX_BATCHES; batch += 1) {
      const rows = await this.loadBatch(afterId, now);
      result.batches += 1;
      if (!rows.length) break;
      result.scanned += rows.length;
      for (const row of rows) {
        await this.processRow(row, now, workSettings, { amDeskStaffIds, ceoDeskStaffIds, superAdminStaffIds }, result);
      }
      afterId = Number(rows[rows.length - 1].presales_id) || afterId;
      if (rows.length < HANDOFF_SLA_SCAN_BATCH) break;
      if (batch === HANDOFF_SLA_SCAN_MAX_BATCHES - 1) {
        this.logger.warn(`Handoff SLA tick hit the batch cap (${HANDOFF_SLA_SCAN_MAX_BATCHES}); remaining rows wait for the next tick.`);
      }
    }

    if (result.sent || result.failed) {
      this.logger.log(
        `Handoff SLA tick scanned=${result.scanned} sent=${result.sent} failed=${result.failed} deferred=${result.deferred} no_recipient=${result.skipped_no_recipient}`,
      );
    }
    return result;
  }

  private async processRow(
    row: Record<string, unknown>,
    now: Date,
    workSettings: ReturnType<typeof currentSolutionWorkSettings>,
    desks: { amDeskStaffIds: number[]; ceoDeskStaffIds: number[]; superAdminStaffIds: number[] },
    result: HandoffSlaTickResult,
  ): Promise<void> {
    const leadId = Number(row.lead_id);
    if (!Number.isInteger(leadId) || leadId <= 0) return;
    const s = (v: unknown): string | null => (v ? String(v) : null);
    const n = (v: unknown): number | null => (v != null ? Number(v) : null);
    const view = buildHandoffSlaView(
      {
        currentStep: inferHandoffSlaStep({
          leadStatus: s(row.status),
          handoffStatus: s(row.handoff_status),
          quoteApprovedAt: s(row.quote_approved_at),
          quoteSentBackAt: s(row.quote_sent_back_at),
          contractSignedAt: s(row.contract_signed_at),
          contractCreatedAt: s(row.contract_created_at),
          implementationStatus: s(row.implementation_status),
        }),
        leadStatus: s(row.status),
        assignedAt: s(row.assigned_at),
        claimedAt: s(row.sales_claimed_at),
        firstCallAt: s(row.first_call_at),
        briefEnteredAt: s(row.brief_entered_at),
        briefDueAt: s(row.brief_due_at),
        handedOffAt: s(row.handed_off_at),
        missingInfoDueAt: s(row.missing_info_due_at),
        handoffStatus: s(row.handoff_status),
        solutionAcceptDueAt: s(row.solution_accept_due_at),
        solutionClaimedAt: s(row.solution_claimed_at),
        solutionDueAt: s(row.solution_due_at),
        solutionRevisionDueAt: s(row.solution_revision_due_at),
        solutionReleasedAt: s(row.solution_released_at),
        customerDueAt: s(row.solution_customer_due_at),
        quoteOfferedAt: s(row.quote_offered_at),
        quoteAcceptDueAt: s(row.quote_accept_due_at),
        quoteAcceptedAt: s(row.quote_accepted_at),
        quoteDueAt: s(row.quote_due_at),
        quoteSentBackAt: s(row.quote_sent_back_at),
        quoteApprovedAt: s(row.quote_approved_at),
        negotiateDueAt: s(row.negotiate_due_at),
        contractDueAt: s(row.contract_due_at),
        contractSignedAt: s(row.contract_signed_at),
        workSettings,
      },
      now,
    );

    for (const clock of view.clocks) {
      if (!isAlertableClock(clock, this.since)) continue;
      const targets = resolveHandoffSlaRecipientIds({
        role: clock.role,
        clockKey: clock.key,
        ownerId: n(row.owner_id),
        quoteAssigneeStaffId: n(row.quote_assignee_staff_id),
        lastSolutionOwnerStaffId: n(row.last_solution_owner_staff_id),
        solutionOwnerStaffId: n(row.solution_owner_staff_id),
        ...desks,
      });
      const unique = [...new Set(targets.filter((id) => Number.isInteger(id) && id > 0))];
      if (!unique.length || !this.notifications) {
        // Nothing can be delivered: do not record or count it as sent.
        result.skipped_no_recipient += 1;
        continue;
      }
      const retryKey = `${leadId}|${clock.key}|${clock.state}|${clock.due_at}`;
      const retry = this.retries.get(retryKey);
      if (retry && (retry.failures >= HANDOFF_SLA_ALERT_MAX_ATTEMPTS || retry.nextAt > now.getTime())) {
        result.deferred += 1;
        continue;
      }
      const claimId = await this.claimAlert(leadId, clock);
      if (claimId == null) continue; // already delivered for this (lead, clock, state, due_at)
      const delivered = await this.notifyTargets(leadId, clock, unique);
      if (delivered > 0) {
        await this.db.query(`UPDATE crm_handoff_sla_alerts SET sent_at = NOW() WHERE id = $1`, [claimId]);
        this.retries.delete(retryKey);
        result.sent += 1;
      } else {
        // Release the claim; retry later with exponential backoff, give up after N failures.
        await this.db.query(`DELETE FROM crm_handoff_sla_alerts WHERE id = $1`, [claimId]);
        this.noteDeliveryFailure(retryKey, now);
        result.failed += 1;
      }
    }
  }

  private noteDeliveryFailure(key: string, now: Date): void {
    const failures = (this.retries.get(key)?.failures ?? 0) + 1;
    this.retries.delete(key);
    this.retries.set(key, { failures, nextAt: now.getTime() + handoffSlaRetryDelayMinutes(failures) * 60_000 });
    if (failures >= HANDOFF_SLA_ALERT_MAX_ATTEMPTS) {
      this.logger.warn(`Handoff SLA alert gave up after ${failures} failed deliveries: ${key}`);
    }
    while (this.retries.size > HANDOFF_SLA_ALERT_RETRY_CAP) {
      const oldest = this.retries.keys().next().value;
      if (oldest === undefined) break;
      this.retries.delete(oldest);
    }
  }

  /**
   * Reserve the dedupe row for (lead, clock, state); returns its id, or null when it was already
   * sent for this due_at. A new due_at (clock reset) takes the row over and alerts again.
   */
  private async claimAlert(leadId: number, clock: HandoffSlaClock): Promise<number | null> {
    const params = [leadId, clock.key, clock.state, clock.due_at];
    // Rows written before due_at existed (epoch default) already alerted this clock/state: adopt them.
    await this.db.query(
      `UPDATE crm_handoff_sla_alerts SET due_at = $4::timestamptz
        WHERE lead_id = $1 AND clock_key = $2 AND state = $3 AND due_at = '1970-01-01 00:00:00+00'`,
      params,
    );
    const res = await this.db.query(
      `INSERT INTO crm_handoff_sla_alerts (lead_id, clock_key, state, due_at)
       VALUES ($1, $2, $3, $4::timestamptz)
       ON CONFLICT (lead_id, clock_key, state) DO UPDATE
         SET due_at = EXCLUDED.due_at, sent_at = NOW()
         WHERE crm_handoff_sla_alerts.due_at IS DISTINCT FROM EXCLUDED.due_at
       RETURNING id`,
      params,
    );
    const id = res.rows[0]?.id;
    return id != null ? Number(id) : null;
  }

  /** Returns how many staff actually received the notification. */
  private async notifyTargets(leadId: number, clock: HandoffSlaClock, staffIds: number[]): Promise<number> {
    if (!this.notifications) return 0;
    const copy = slaNotifyCopy(clock, leadId);
    const payload = {
      kind: clock.state === 'breach' ? 'handoff_sla_breach' : 'handoff_sla_warning',
      title: copy.title,
      body: copy.body,
      link_href: `/crm/leads/${leadId}`,
    };
    let delivered = 0;
    for (const staffId of staffIds) {
      try {
        const userId = await this.notifications.notifyStaff(staffId, payload);
        if (userId) delivered += 1;
        else this.logger.warn(`SLA notify not delivered lead=${leadId} staff=${staffId}`);
      } catch (err) {
        this.logger.warn(
          `SLA notify failed lead=${leadId} staff=${staffId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return delivered;
  }

  private async accountManagerStaffIds(): Promise<number[]> {
    const result = await this.db.query(
      `SELECT DISTINCT s.id AS staff_id
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE
          AND lower(replace(p.code, ' ', '')) IN ('acm', 'kd-01', 'kd01')`,
    );
    return result.rows
      .map((r) => Number(r.staff_id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  private async superAdminStaffIds(): Promise<number[]> {
    const result = await this.db.query(
      `SELECT DISTINCT s.id AS staff_id
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE
          AND lower(replace(replace(p.code, ' ', ''), '_', '-')) IN ('super-admin', 'superadmin')`,
    );
    return result.rows
      .map((r) => Number(r.staff_id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  /** AM desk operators: Account Managers plus SUPER-ADMIN (UAT AM desk). */
  private async amDeskStaffIds(): Promise<number[]> {
    const [am, supers] = await Promise.all([this.accountManagerStaffIds(), this.superAdminStaffIds()]);
    return [...new Set([...am, ...supers])];
  }

  private async ceoStaffIds(): Promise<number[]> {
    const result = await this.db.query(
      `SELECT DISTINCT s.id AS staff_id
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE
          AND lower(replace(p.code, ' ', '')) = 'ceo'`,
    );
    return result.rows
      .map((r) => Number(r.staff_id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  /** CEO desk operators: CEO position plus SUPER-ADMIN (UAT has no dedicated CEO stub). */
  private async ceoDeskStaffIds(): Promise<number[]> {
    const [ceos, supers] = await Promise.all([this.ceoStaffIds(), this.superAdminStaffIds()]);
    return [...new Set([...ceos, ...supers])];
  }
}
