import { pickRoundRobinStaffId } from '../leads/ingest/lead-assign-scope.util';

/** Round-robin pool key for Solution auto-assign (AM position + HR "Nhận Solution"). */
export const SOLUTION_AUTO_ASSIGN_POOL_KEY = 'solution_am';
/** crm_lead_assignment_log.reason for a round-robin pick (also the rotation state). */
export const SOLUTION_AUTO_ASSIGN_REASON = 'solution_auto_assign';
/** Reason when the previous Solution owner is kept on resubmit (not part of the rotation). */
export const SOLUTION_AUTO_ASSIGN_PREVIOUS_REASON = 'solution_auto_assign:previous_owner';

export type SolutionAssignDecision =
  | { action: 'keep'; staffId: number | null; why: 'assigned_in_pool' | 'reclaim_previous' }
  | { action: 'assign'; staffId: number; why: 'previous_owner' | 'round_robin' }
  | { action: 'none'; staffId: null; why: 'empty_pool' };

function positiveId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Who should own the Solution step when Sales submits to AM (Tú 14/11/2026: AMs by default,
 * plus anyone ticked "Nhận Solution", assigned automatically).
 * - assigned_am already in the pool: keep it.
 * - no assigned_am but the previous owner is in the pool: keep the existing auto-reclaim path.
 * - assigned_am is not a pool member (e.g. still the Sales owner) but the previous owner is: give it back to them.
 * - otherwise round-robin the pool; empty pool: no change.
 */
export function decideSolutionAssignee(input: {
  assignedAm: unknown;
  assignedAmInPool: boolean;
  lastOwner: unknown;
  lastOwnerInPool: boolean;
  poolIds: number[];
  lastAutoStaffId: unknown;
}): SolutionAssignDecision {
  const am = positiveId(input.assignedAm);
  const last = positiveId(input.lastOwner);
  if (am != null && input.assignedAmInPool) return { action: 'keep', staffId: am, why: 'assigned_in_pool' };
  if (am == null && last != null && input.lastOwnerInPool) {
    return { action: 'keep', staffId: last, why: 'reclaim_previous' };
  }
  if (last != null && input.lastOwnerInPool) return { action: 'assign', staffId: last, why: 'previous_owner' };
  const pool = [...new Set(input.poolIds.map((id) => positiveId(id)).filter((id): id is number => id != null))];
  if (!pool.length) return { action: 'none', staffId: null, why: 'empty_pool' };
  const lastAuto = positiveId(input.lastAutoStaffId) ?? 0;
  const staffId = pickRoundRobinStaffId(pool, SOLUTION_AUTO_ASSIGN_POOL_KEY, [
    { pool_key: SOLUTION_AUTO_ASSIGN_POOL_KEY, last_staff_id: lastAuto },
  ]);
  return { action: 'assign', staffId, why: 'round_robin' };
}
