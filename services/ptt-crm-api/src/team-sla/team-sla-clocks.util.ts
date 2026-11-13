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

export function saleUpdateAfterClaimHours(doc?: TeamSlaDocument | null): number {
  const profile = teamSlaProfile(doc ?? defaultTeamSlaDocument(), 'sale_service');
  return positiveNumber(profile.sale.update_after_claim_hours, 2);
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
