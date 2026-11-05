import { Pool } from 'pg';
import {
  addBusinessMinutes,
  classifySlaStatus,
  elapsedBusinessMs,
  policySliceFromRow,
} from './csd-sla.util';
import type { CsdSlaStatus, CsdTicketStatus } from './csd.types';

const OPEN_STATUSES: CsdTicketStatus[] = [
  'new',
  'triaged',
  'assigned',
  'in_progress',
  'waiting_for_client',
  'waiting_for_internal_approval',
  'on_hold',
  'reopened',
  'escalated',
];

const SLA_THRESHOLDS = [
  { pct: 70, eventKey: 'sla.at_risk', title: 'SLA sắp rủi ro', severity: 'warning' as const },
  { pct: 90, eventKey: 'sla.near_breach', title: 'SLA gần vi phạm', severity: 'warning' as const },
  { pct: 100, eventKey: 'sla.breached', title: 'SLA đã vi phạm', severity: 'critical' as const },
];

type TicketRow = {
  id: string;
  code: string;
  status: CsdTicketStatus;
  priority: string;
  assignee_staff_id: number | null;
  owner_staff_id: number | null;
  created_by_staff_id: number | null;
  created_at: Date;
  sla_resolution_due_at: Date | null;
  sla_status: CsdSlaStatus;
  sla_paused: boolean;
  sla_paused_seconds: number;
};

type PolicyRow = {
  workday_start: string;
  workday_end: string;
  workdays: number[];
  at_risk_pct: number;
  near_breach_pct: number;
  holidays: string[];
};

export async function tickCsdSla(now: Date, db: Pool): Promise<{ updated: number; escalated: number }> {
  const client = await db.connect();
  let updated = 0;
  let escalated = 0;

  try {
    await client.query('BEGIN');

    const policyRes = await client.query(
      `SELECT p.workday_start, p.workday_end, p.workdays, p.at_risk_pct, p.near_breach_pct,
              COALESCE(
                (SELECT array_agg(h.holiday_date::text ORDER BY h.holiday_date)
                 FROM csd_business_calendar h WHERE h.tenant_id = p.tenant_id),
                ARRAY[]::text[]
              ) AS holidays
       FROM csd_sla_policies p
       WHERE p.tenant_id = 'PTT' AND p.is_default = TRUE AND p.is_deleted = FALSE
       LIMIT 1`,
    );
    const policy = policyRes.rows[0] as PolicyRow | undefined;
    if (!policy) {
      await client.query('COMMIT');
      return { updated: 0, escalated: 0 };
    }
    const slice = policySliceFromRow({
      workday_start: String(policy.workday_start).slice(0, 5),
      workday_end: String(policy.workday_end).slice(0, 5),
      workdays: policy.workdays,
      at_risk_pct: Number(policy.at_risk_pct),
      near_breach_pct: Number(policy.near_breach_pct),
      holidays: policy.holidays ?? [],
    });

    const ticketsRes = await client.query(
      `SELECT id, code, status, priority, assignee_staff_id, owner_staff_id, created_by_staff_id,
              created_at, sla_resolution_due_at, sla_status, sla_paused, sla_paused_seconds
       FROM csd_tickets
       WHERE tenant_id = 'PTT'
         AND is_deleted = FALSE
         AND status = ANY($1::text[])
       FOR UPDATE SKIP LOCKED
       LIMIT 100`,
      [OPEN_STATUSES],
    );

    for (const raw of ticketsRes.rows as TicketRow[]) {
      if (!raw.sla_resolution_due_at) continue;

      const createdAt = new Date(raw.created_at);
      const dueAt = new Date(raw.sla_resolution_due_at);
      const totalMs = elapsedBusinessMs(createdAt, dueAt, slice, 0);
      const usedMs = elapsedBusinessMs(createdAt, now, slice, raw.sla_paused_seconds * 1000);
      const usedPct = totalMs > 0 ? (usedMs / totalMs) * 100 : 100;
      const nextStatus = classifySlaStatus(usedPct, raw.sla_paused);

      if (nextStatus !== raw.sla_status) {
        await client.query(
          `UPDATE csd_tickets SET sla_status = $2, updated_at = NOW() WHERE id = $1`,
          [raw.id, nextStatus],
        );
        updated += 1;

        await client.query(
          `INSERT INTO csd_ticket_activities (
             tenant_id, ticket_id, actor_type, event_key, from_value, to_value, metadata_json
           ) VALUES ('PTT', $1, 'system', 'sla_status_changed', $2, $3, $4)`,
          [raw.id, raw.sla_status, nextStatus, JSON.stringify({ used_pct: Math.round(usedPct) })],
        );
      }

      for (const threshold of SLA_THRESHOLDS) {
        if (usedPct < threshold.pct) continue;
        const notifyStaff = raw.assignee_staff_id ?? raw.owner_staff_id ?? raw.created_by_staff_id;
        if (!notifyStaff) continue;

        const exists = await client.query(
          `SELECT 1 FROM csd_notifications
           WHERE tenant_id = 'PTT' AND staff_id = $1 AND event_key = $2 AND entity_id = $3
           LIMIT 1`,
          [notifyStaff, threshold.eventKey, raw.id],
        );
        if (exists.rows.length) continue;

        await client.query(
          `INSERT INTO csd_notifications (
             tenant_id, staff_id, event_key, title_vi, body_vi, entity_type, entity_id, severity
           ) VALUES ('PTT', $1, $2, $3, $4, 'ticket', $5, $6)`,
          [
            notifyStaff,
            threshold.eventKey,
            threshold.title,
            `${raw.code}: ${Math.round(usedPct)}% SLA`,
            raw.id,
            threshold.severity,
          ],
        );

        await client.query(
          `INSERT INTO csd_ticket_activities (
             tenant_id, ticket_id, actor_type, event_key, metadata_json
           ) VALUES ('PTT', $1, 'system', $2, $3)`,
          [raw.id, threshold.eventKey, JSON.stringify({ used_pct: Math.round(usedPct) })],
        );
      }

      if (
        raw.priority === 'P1' &&
        raw.assignee_staff_id == null &&
        raw.status !== 'escalated'
      ) {
        const unassignedMs = elapsedBusinessMs(createdAt, now, slice, 0);
        const thresholdMs = elapsedBusinessMs(createdAt, addBusinessMinutes(createdAt, 30, slice), slice, 0);
        if (unassignedMs >= thresholdMs) {
          await client.query(
            `UPDATE csd_tickets
             SET status = 'escalated', updated_at = NOW()
             WHERE id = $1 AND status <> 'escalated'`,
            [raw.id],
          );
          escalated += 1;
          await client.query(
            `INSERT INTO csd_ticket_activities (
               tenant_id, ticket_id, actor_type, event_key, from_value, to_value
             ) VALUES ('PTT', $1, 'system', 'escalated_unassigned_p1', $2, 'escalated')`,
            [raw.id, raw.status],
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { updated, escalated };
}
