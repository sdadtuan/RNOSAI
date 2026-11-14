import { Injectable, Logger, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { buildHandoffSlaView, slaNotifyCopy, type HandoffSlaClock, type HandoffSlaRole } from './handoff-sla.util';
import { loadMarketingSolutionWorkSettings } from './team-sla-solution-settings';

const SCAN_LIMIT = 200;

@Injectable()
export class HandoffSlaAlertService {
  private readonly logger = new Logger(HandoffSlaAlertService.name);

  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly notifications?: StaffNotificationsRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async ensureTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_handoff_sla_alerts (
        id          BIGSERIAL PRIMARY KEY,
        lead_id     BIGINT NOT NULL,
        clock_key   TEXT NOT NULL,
        state       TEXT NOT NULL,
        sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_handoff_sla_alerts_uq UNIQUE (lead_id, clock_key, state)
      )
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

  async tick(now = new Date()): Promise<{ scanned: number; sent: number }> {
    await this.ensureTable();
    const { rows } = await this.db.query(
      `
      SELECT l.sqlite_lead_id AS lead_id,
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
             ps.quote_accept_due_at,
             ps.quote_accepted_at,
             ps.quote_due_at,
             ps.quote_sent_back_at,
             ps.quote_approved_at,
             ps.quote_assignee_staff_id,
             ps.quote_ceo_escalated_at,
             ps.negotiate_due_at,
             ps.contract_due_at,
             ps.contract_signed_at,
             l.sales_claimed_at
        FROM crm_lead_presales ps
        JOIN crm_leads l ON l.sqlite_lead_id = ps.lead_id
       WHERE ps.contract_signed_at IS NULL
         AND COALESCE(l.status, '') NOT IN ('lost', 'mat', 'huy', 'cancelled')
       ORDER BY ps.updated_at DESC NULLS LAST
       LIMIT $1
      `,
      [SCAN_LIMIT],
    );

    const workSettings = loadMarketingSolutionWorkSettings();
    let sent = 0;
    const adminIds = await this.superAdminStaffIds();
    const ceoIds = await this.staffIdsByCodes(['CEO', 'SUPER-ADMIN']);

    for (const row of rows) {
      const leadId = Number(row.lead_id);
      if (!Number.isInteger(leadId) || leadId <= 0) continue;
      const view = buildHandoffSlaView(
        {
          currentStep: null,
          assignedAt: row.assigned_at ? String(row.assigned_at) : null,
          claimedAt: row.sales_claimed_at ? String(row.sales_claimed_at) : null,
          firstCallAt: row.first_call_at ? String(row.first_call_at) : null,
          briefEnteredAt: row.brief_entered_at ? String(row.brief_entered_at) : null,
          briefDueAt: row.brief_due_at ? String(row.brief_due_at) : null,
          handedOffAt: row.handed_off_at ? String(row.handed_off_at) : null,
          missingInfoDueAt: row.missing_info_due_at ? String(row.missing_info_due_at) : null,
          handoffStatus: row.handoff_status ? String(row.handoff_status) : null,
          solutionAcceptDueAt: row.solution_accept_due_at ? String(row.solution_accept_due_at) : null,
          solutionClaimedAt: row.solution_claimed_at ? String(row.solution_claimed_at) : null,
          solutionDueAt: row.solution_due_at ? String(row.solution_due_at) : null,
          solutionRevisionDueAt: row.solution_revision_due_at ? String(row.solution_revision_due_at) : null,
          solutionReleasedAt: row.solution_released_at ? String(row.solution_released_at) : null,
          customerDueAt: row.solution_customer_due_at ? String(row.solution_customer_due_at) : null,
          quoteAcceptDueAt: row.quote_accept_due_at ? String(row.quote_accept_due_at) : null,
          quoteAcceptedAt: row.quote_accepted_at ? String(row.quote_accepted_at) : null,
          quoteDueAt: row.quote_due_at ? String(row.quote_due_at) : null,
          quoteSentBackAt: row.quote_sent_back_at ? String(row.quote_sent_back_at) : null,
          quoteApprovedAt: row.quote_approved_at ? String(row.quote_approved_at) : null,
          negotiateDueAt: row.negotiate_due_at ? String(row.negotiate_due_at) : null,
          contractDueAt: row.contract_due_at ? String(row.contract_due_at) : null,
          contractSignedAt: row.contract_signed_at ? String(row.contract_signed_at) : null,
          workSettings,
        },
        now,
      );

      for (const clock of view.clocks) {
        if (clock.state !== 'warning' && clock.state !== 'breach') continue;
        const first = await this.claimAlert(leadId, clock.key, clock.state);
        if (!first) continue;
        const targets = new Set<number>([
          ...this.ownerIdsFor(clock.role, row),
          ...adminIds,
          ...(clock.role === 'CEO' || (clock.key === 'quote_accept' && clock.state === 'breach') || (clock.key === 'quote_finish' && clock.state === 'breach')
            ? ceoIds
            : []),
        ]);
        await this.notifyTargets(leadId, clock, [...targets]);
        sent += 1;
      }
    }

    this.logger.log(`Handoff SLA tick scanned=${rows.length} sent=${sent}`);
    return { scanned: rows.length, sent };
  }

  private ownerIdsFor(role: HandoffSlaRole, row: Record<string, unknown>): number[] {
    const ids: number[] = [];
    const push = (raw: unknown) => {
      const n = Number(raw);
      if (Number.isInteger(n) && n > 0) ids.push(n);
    };
    if (role === 'Sales') {
      push(row.owner_id);
      push(row.handed_off_by_staff_id);
    } else if (role === 'AM') {
      push(row.quote_assignee_staff_id);
      push(row.last_solution_owner_staff_id);
      push(row.solution_owner_staff_id);
    } else if (role === 'Marketing') {
      push(row.solution_owner_staff_id);
      push(row.last_solution_owner_staff_id);
    }
    return ids;
  }

  private async claimAlert(leadId: number, clockKey: string, state: string): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO crm_handoff_sla_alerts (lead_id, clock_key, state)
       VALUES ($1, $2, $3)
       ON CONFLICT (lead_id, clock_key, state) DO NOTHING
       RETURNING id`,
      [leadId, clockKey, state],
    );
    return Boolean(result.rowCount);
  }

  private async notifyTargets(leadId: number, clock: HandoffSlaClock, staffIds: number[]): Promise<void> {
    if (!this.notifications) return;
    const unique = [...new Set(staffIds.filter((id) => Number.isInteger(id) && id > 0))];
    const copy = slaNotifyCopy(clock, leadId);
    const payload = {
      kind: clock.state === 'breach' ? 'handoff_sla_breach' : 'handoff_sla_warning',
      title: copy.title,
      body: copy.body,
      link_href: `/crm/leads/${leadId}`,
    };
    for (const staffId of unique) {
      await this.notifications.notifyStaff(staffId, payload).catch((err) => {
        this.logger.warn(
          `SLA notify failed lead=${leadId} staff=${staffId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }

  private async staffIdsByCodes(codes: string[]): Promise<number[]> {
    const normalized = codes.map((c) => c.toLowerCase().replace(/\s+/g, ''));
    const result = await this.db.query(
      `SELECT s.id
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE
          AND lower(replace(p.code, ' ', '')) = ANY($1::text[])`,
      [normalized],
    );
    return result.rows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);
  }

  private async superAdminStaffIds(): Promise<number[]> {
    const result = await this.db.query(
      `SELECT s.id, p.code
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
        WHERE s.active IS TRUE`,
    );
    return result.rows
      .filter((r) => isSuperAdminPositionCode(String(r.code ?? '')))
      .map((r) => Number(r.id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }
}
