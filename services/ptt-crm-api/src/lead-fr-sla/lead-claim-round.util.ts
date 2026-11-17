/**
 * Stage 1 (Tiếp nhận Lead) claim round — CRM Workflow V5.1 §01 / §05.
 *
 * - New lead: CRM gives it to Sales #1 by the configured order (crm_staff.sort_order, id).
 * - Each assignment starts a claim window (team-SLA sale_service.claim_in_hours_minutes, business hours).
 * - Missed: QUÁ HẠN NHẬN LEAD, mark the Sale tried, give it to the next untried Sale (no repeats in a round).
 * - Everyone tried: CHỜ AM PHÂN LEAD, notify AM, stop auto-rotation. AM assigns by hand (fresh window).
 * - A manual (AM) assignment that is missed goes straight back to CHỜ AM PHÂN LEAD.
 */

import { acceptDueAt, businessCalendar } from '../leads-funnel/business-hours.util';
import { loadPausedIntakeStaffIds } from '../ae-team/ae-intake-gate';
import {
  CLAIM_TIMEOUT_EXCLUDED_STATUSES,
  claimTimeoutSalesPositionSql,
  parsePreviousAssigneeIds,
} from './lead-claim-timeout-reassign.util';

export const CLAIM_QUEUE_AWAITING_AM = 'cho_am_phan_lead';
export const CLAIM_QUEUE_AWAITING_AM_LABEL = 'Chờ AM phân lead';
export const CLAIM_ROUND_EXHAUSTED_DECISION = 'round_exhausted';

export type ClaimRoundMode = 'auto' | 'manual';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClaimSqlQuery = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

/** Additive DDL for the round state + richer history. Safe to run repeatedly. */
export const CLAIM_ROUND_LEADS_DDL = `
  ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS claim_round_tried JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS claim_round_mode TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS claim_queue_state TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS claim_queue_state_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS callback_reminded_at TIMESTAMPTZ;
`;

export const CLAIM_ROUND_EVENTS_DDL = `
  ALTER TABLE crm_lead_reassign_events
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claim_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assign_mode TEXT NOT NULL DEFAULT '';
`;

export function parseRoundTried(raw: unknown): number[] {
  return Array.from(new Set(parsePreviousAssigneeIds(raw)));
}

/**
 * Next untried Sale after the current owner in the configured order (cyclic).
 * Never returns someone in `tried`, the current owner, or a paused Sale.
 */
export function pickNextUntriedSale(
  order: number[],
  tried: number[],
  currentOwnerId: number | null,
  paused: Set<number> = new Set(),
): number | null {
  const list = order.filter((id, i) => order.indexOf(id) === i);
  const n = list.length;
  if (!n) return null;
  const blocked = new Set<number>(tried.map(Number));
  if (currentOwnerId != null) blocked.add(Number(currentOwnerId));
  const idx = currentOwnerId != null ? list.indexOf(Number(currentOwnerId)) : -1;
  for (let step = 1; step <= n; step += 1) {
    const id = list[(((idx + step) % n) + n) % n];
    if (!blocked.has(id) && !paused.has(id)) return id;
  }
  return null;
}

/** First Sale for a brand-new lead: next after the last one that got a new lead (round-robin by order). */
export function pickFirstSale(
  order: number[],
  lastStaffId: number | null,
  paused: Set<number> = new Set(),
): number | null {
  const list = order.filter((id) => !paused.has(id));
  if (!list.length) return null;
  const idx = lastStaffId != null ? list.indexOf(Number(lastStaffId)) : -1;
  return list[(idx + 1) % list.length] ?? list[0];
}

export function claimDueAtFor(assignedAt: Date, claimMinutes: number): Date {
  return acceptDueAt(assignedAt, Math.max(1, Number(claimMinutes) || 15), businessCalendar('sale_service'));
}

/** Sales pool in configured order. Project pool if the project has Sales; else the global pool. */
export async function listSalesOrder(
  query: ClaimSqlQuery,
  projectId: string | null,
): Promise<{ source: 'project' | 'global'; order: number[] }> {
  const salesPos = claimTimeoutSalesPositionSql('p');
  const base = (projectJoin: string) => `
    SELECT s.id AS staff_id
      FROM crm_staff s
      JOIN crm_positions p ON p.id = s.position_id
      ${projectJoin}
     WHERE s.active IS TRUE
       AND COALESCE(s.can_receive_leads, FALSE) IS TRUE
       AND ${salesPos}
     ORDER BY COALESCE(s.sort_order, 0) ASC, s.id ASC`;
  const toIds = (rows: Array<{ staff_id: unknown }>) =>
    rows.map((r) => Number(r.staff_id)).filter((id) => Number.isFinite(id) && id > 0);
  if (projectId) {
    try {
      const proj = await query(
        base(`JOIN crm_b2b_project_staff ps ON ps.staff_id = s.id
                AND ps.project_id = $1::uuid
                AND ps.assign_enabled IS TRUE`),
        [projectId],
      );
      const ids = toIds(proj.rows);
      if (ids.length) return { source: 'project', order: ids };
    } catch {
      /* project staff table may be absent; fall back to global */
    }
  }
  const all = await query(base(''), []);
  return { source: 'global', order: toIds(all.rows) };
}

export async function loadPausedSales(query: ClaimSqlQuery): Promise<Set<number>> {
  return loadPausedIntakeStaffIds((sql) => query(sql));
}

export async function isSalesStaff(query: ClaimSqlQuery, staffId: number | null | undefined): Promise<boolean> {
  const id = Number(staffId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const result = await query(
    `SELECT 1 FROM crm_staff s JOIN crm_positions p ON p.id = s.position_id
      WHERE s.id = $1 AND s.active IS TRUE AND ${claimTimeoutSalesPositionSql('p')} LIMIT 1`,
    [id],
  );
  return result.rows.length > 0;
}

/** Active Account Managers (ACM / KD-01), same rule as the AM desk. */
export async function listAccountManagerIds(query: ClaimSqlQuery): Promise<number[]> {
  const result = await query(
    `SELECT DISTINCT s.id AS staff_id
       FROM crm_staff s
       JOIN crm_positions p ON p.id = s.position_id
      WHERE s.active IS TRUE
        AND lower(replace(p.code, ' ', '')) IN ('acm', 'kd-01', 'kd01')`,
    [],
  );
  return result.rows.map((r) => Number(r.staff_id)).filter((id) => Number.isFinite(id) && id > 0);
}

export async function insertClaimHistory(
  query: ClaimSqlQuery,
  input: {
    leadId: number;
    fromStaffId: number | null;
    toStaffId: number | null;
    reason: string;
    decision: string;
    mode: ClaimRoundMode;
    assignedAt: Date | null;
    claimDueAt: Date | null;
    notes?: string;
    jobRunId?: string;
  },
): Promise<void> {
  await query(
    `INSERT INTO crm_lead_reassign_events
       (sqlite_lead_id, from_staff_id, to_staff_id, would_to_staff_id, reason, decision, notes,
        attempt_count_snapshot, job_run_id, dry_run, assigned_at, claim_due_at, assign_mode)
     VALUES ($1,$2,$3,$3,$4,$5,$6,0,$7,FALSE,$8,$9,$10)`,
    [
      input.leadId,
      input.fromStaffId,
      input.toStaffId,
      input.reason.slice(0, 120),
      input.decision.slice(0, 80),
      String(input.notes ?? '').slice(0, 2000),
      input.jobRunId ?? '',
      input.assignedAt?.toISOString() ?? null,
      input.claimDueAt?.toISOString() ?? null,
      input.mode,
    ],
  );
}

/**
 * Start a fresh claim round for `ownerId` (new lead = auto, AM hand-assign = manual).
 * Clears CHỜ AM PHÂN LEAD and any previous claim; logs history. Never deletes history.
 */
export async function startClaimRound(
  query: ClaimSqlQuery,
  input: {
    leadId: number;
    ownerId: number;
    fromOwnerId: number | null;
    mode: ClaimRoundMode;
    reason: string;
    claimMinutes: number;
    notes?: string;
  },
): Promise<{ assignedAt: Date; claimDueAt: Date } | null> {
  const result = await query(
    `UPDATE crm_leads SET
       claim_round_tried = jsonb_build_array($2::bigint),
       claim_round_mode = $3,
       claim_queue_state = '',
       claim_queue_state_at = NULL,
       sales_claimed_at = NULL,
       sales_claimed_by = NULL,
       assigned_at = COALESCE(assigned_at, NOW()),
       updated_at = NOW()
     WHERE sqlite_lead_id = $1 AND owner_id = $2
     RETURNING assigned_at`,
    [input.leadId, input.ownerId, input.mode],
  );
  const raw = result.rows[0]?.assigned_at;
  if (raw == null) return null;
  const assignedAt = raw instanceof Date ? raw : new Date(String(raw));
  const claimDueAt = claimDueAtFor(assignedAt, input.claimMinutes);
  await insertClaimHistory(query, {
    leadId: input.leadId,
    fromStaffId: input.fromOwnerId,
    toStaffId: input.ownerId,
    reason: input.reason,
    decision: 'assigned',
    mode: input.mode,
    assignedAt,
    claimDueAt,
    notes: input.notes,
  });
  return { assignedAt, claimDueAt };
}

/** AM (ACM / KD-01) does not press Nhận lead. Super Admin still can. */
export function amCannotClaimSalesLead(isAccountManager: boolean, isSuperAdmin: boolean): boolean {
  return isAccountManager && !isSuperAdmin;
}

/** Step-1 statuses only: owner changes after Tư vấn are not a claim round. */
export function isStep1Status(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return !(CLAIM_TIMEOUT_EXCLUDED_STATUSES as readonly string[]).includes(s);
}
