import type { RawLeadReadinessStatus } from './quality/readiness-classify.util';

const ALLOWED: ReadonlySet<string> = new Set([
  'READY_TO_PUSH',
  'NEEDS_REVIEW',
  'MISSING_CONTACT',
  'DUPLICATE_OR_BLACKLIST',
]);

export function isRawLeadReadinessStatus(v: unknown): v is RawLeadReadinessStatus {
  return typeof v === 'string' && ALLOWED.has(v);
}

/** Manual PATCH to READY when lead already carries blacklist/DNC reasons. */
export function assertManualReadyAllowed(input: {
  next: RawLeadReadinessStatus;
  current_reason_codes?: string[] | null;
  force_ready?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.next !== 'READY_TO_PUSH') return { ok: true };
  if (input.force_ready) return { ok: true };
  const codes = (input.current_reason_codes ?? []).map((c) => String(c).toUpperCase());
  if (codes.includes('BLACKLIST') || codes.includes('DNC')) {
    return { ok: false, error: 'cannot_ready_blacklist_or_dnc' };
  }
  return { ok: true };
}
