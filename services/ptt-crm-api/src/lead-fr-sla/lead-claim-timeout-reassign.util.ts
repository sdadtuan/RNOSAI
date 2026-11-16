/**
 * Claim-timeout auto-reassign — pure helpers.
 * Kicks unclaimed step-1 leads whose sale_service claim deadline has passed.
 */

import {
  acceptDueAt,
  isInsideBusinessHours,
  type BusinessCalendar,
} from '../leads-funnel/business-hours.util';
import type { PoolCandidate } from './lead-sla-reassign.util';

/** Disabled only when set to 0/false/off/no. Defaults ON. */
export function isClaimTimeoutReassignEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = String(env.PTT_LEAD_CLAIM_TIMEOUT_REASSIGN ?? '1')
    .trim()
    .toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

export const CLAIM_TIMEOUT_TICK_MS = 60_000;
export const CLAIM_TIMEOUT_TICK_CAP = 50;
export const CLAIM_TIMEOUT_REASON = 'claim_timeout';

/** Statuses that are past step 1 or already closed — never auto-kick. */
export const CLAIM_TIMEOUT_EXCLUDED_STATUSES = [
  'lost',
  'chot',
  'won',
  'post_sale',
  'nurture',
  'pending_cleanup',
  'dang_tu_van',
  'hen_gap',
  'bao_gia',
  'dam_phan',
  'proposal',
  'trien_khai',
] as const;

export function claimTimeoutExcludedStatusSql(): string {
  return CLAIM_TIMEOUT_EXCLUDED_STATUSES.map((s) => `'${s}'`).join(', ');
}

export function isClaimDeadlinePassed(
  assignedAt: Date,
  now: Date,
  claimMinutes: number,
  calendar: BusinessCalendar,
): boolean {
  return acceptDueAt(assignedAt, claimMinutes, calendar).getTime() <= now.getTime();
}

export function isClaimTimeoutWindowOpen(
  now: Date,
  calendar: BusinessCalendar,
): boolean {
  return isInsideBusinessHours(now, calendar);
}

/**
 * Sales IC roles only (AE / Sale / NV kinh doanh). Same roots as the AE team view
 * (isAePosition: ae, ae-*, ae_*) plus sale/sales for that desk. Not GDKD, MKL,
 * Super-Admin, AM (ACM/KD-01), Marketing, or any other role — even if
 * can_receive_leads is true.
 */
export const CLAIM_TIMEOUT_SALES_POSITION_ROOTS = ['ae', 'sale', 'sales'] as const;

export function isClaimTimeoutSalesPosition(
  positionCode: string | null | undefined,
): boolean {
  const code = String(positionCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return CLAIM_TIMEOUT_SALES_POSITION_ROOTS.some(
    (root) =>
      code === root || code.startsWith(`${root}-`) || code.startsWith(`${root}_`),
  );
}

/** SQL predicate on a crm_positions alias. Underscore is escaped in LIKE. */
export function claimTimeoutSalesPositionSql(alias = 'p'): string {
  const col = `lower(replace(${alias}.code, ' ', ''))`;
  const parts = CLAIM_TIMEOUT_SALES_POSITION_ROOTS.flatMap((root) => [
    `${col} = '${root}'`,
    `${col} LIKE '${root}-%'`,
    `${col} LIKE '${root}\\_%' ESCAPE '\\'`,
  ]);
  return `(${parts.join(' OR ')})`;
}

/**
 * Prefer the project Sales pool when it has someone other than the current owner.
 * Otherwise use the global Sales pool (AE / sale / sales + can_receive_leads + active).
 * If neither has an eligible Sale, the caller must skip (do not reassign).
 */
export function resolveClaimTimeoutPool(
  projectPool: PoolCandidate[],
  globalPool: PoolCandidate[],
  currentOwnerId: number | null,
): { source: 'project' | 'global'; candidates: PoolCandidate[] } {
  const owner = currentOwnerId != null && Number.isFinite(currentOwnerId) ? currentOwnerId : null;
  const projectOthers = projectPool.filter((c) => c.staff_id !== owner);
  if (projectOthers.length > 0) {
    return { source: 'project', candidates: projectPool };
  }
  return { source: 'global', candidates: globalPool };
}

export function parsePreviousAssigneeIds(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) =>
        typeof x === 'object' && x && 'staff_id' in x
          ? Number((x as { staff_id: number }).staff_id)
          : Number(x),
      )
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  if (typeof raw === 'string') {
    try {
      return parsePreviousAssigneeIds(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}
