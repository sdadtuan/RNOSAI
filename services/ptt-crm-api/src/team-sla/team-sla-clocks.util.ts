/** Resolve configured team-SLA clocks with safe defaults (never hard-code 1 minute). */

import type { TeamSlaDocument } from './team-sla-profiles';
import { defaultTeamSlaDocument, teamSlaProfile } from './team-sla-profiles';

export const DEFAULT_CLAIM_MINUTES = 15;
export const DEFAULT_MISSING_INFO_HOURS = 1;

function positiveNumber(raw: number | null | undefined, fallback: number): number {
  if (raw == null || raw === ('' as never)) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function saleClaimMinutes(doc?: TeamSlaDocument | null): number {
  const profile = teamSlaProfile(doc ?? defaultTeamSlaDocument(), 'sale_service');
  return positiveNumber(profile.sale.claim_in_hours_minutes, DEFAULT_CLAIM_MINUTES);
}

export function marketingClaimMinutes(doc?: TeamSlaDocument | null): number {
  const profile = teamSlaProfile(doc ?? defaultTeamSlaDocument(), 'marketing');
  return positiveNumber(profile.marketing.claim_in_hours_minutes, DEFAULT_CLAIM_MINUTES);
}

export function saleMissingInfoHours(doc?: TeamSlaDocument | null): number {
  const profile = teamSlaProfile(doc ?? defaultTeamSlaDocument(), 'sale_service');
  return positiveNumber(profile.sale.missing_info_hours, DEFAULT_MISSING_INFO_HOURS);
}

/** Doc V5.1 §05 bước 5: Sales liên hệ khách trong 1 giờ sau khi nhận. */
export const DEFAULT_UPDATE_AFTER_CLAIM_HOURS = 1;
/** Min gap between phone call attempts (CHỜ GỌI LẠI): 5 minutes. */
export const DEFAULT_RETRY_GAP_HOURS = 5 / 60;

export function saleUpdateAfterClaimHours(doc?: TeamSlaDocument | null): number {
  const profile = teamSlaProfile(doc ?? defaultTeamSlaDocument(), 'sale_service');
  const n = positiveNumber(profile.sale.update_after_claim_hours, DEFAULT_UPDATE_AFTER_CLAIM_HOURS);
  return n > 0 ? n : DEFAULT_UPDATE_AFTER_CLAIM_HOURS;
}

export function saleRetryGapHours(doc?: TeamSlaDocument | null): number {
  const profile = teamSlaProfile(doc ?? defaultTeamSlaDocument(), 'sale_service');
  const n = positiveNumber(profile.sale.retry_gap_hours, DEFAULT_RETRY_GAP_HOURS);
  return n > 0 ? n : DEFAULT_RETRY_GAP_HOURS;
}

export function formatMinutesVi(minutes: number): string {
  const n = positiveNumber(minutes, DEFAULT_CLAIM_MINUTES);
  if (n === 1) return '1 phút';
  if (Number.isInteger(n)) return `${n} phút`;
  return `${n} phút`;
}

export function formatHoursVi(hours: number): string {
  const n = positiveNumber(hours, DEFAULT_MISSING_INFO_HOURS);
  if (n === 1) return '1 giờ';
  return `${n} giờ`;
}
