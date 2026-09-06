import type { RevopsScope } from './revops.types';

export function hasRevopsCap(
  caps: Array<{ section: string; action: string }> | undefined,
  action: 'view' | 'view_team' | 'view_all' | 'manage',
): boolean {
  if (!caps?.length) return false;
  return caps.some((c) => c.section === 'crm_revops' && c.action === action);
}

export function canSeeRevops(caps: Array<{ section: string; action: string }> | undefined): boolean {
  return (
    hasRevopsCap(caps, 'view') ||
    hasRevopsCap(caps, 'view_team') ||
    hasRevopsCap(caps, 'view_all') ||
    hasRevopsCap(caps, 'manage')
  );
}

/** view_all / manage → every BU; view_team → team; view → self. */
export function resolveRevopsScope(opts: {
  requested?: string;
  caps: Array<{ section: string; action: string }>;
}): RevopsScope {
  const hasAll = hasRevopsCap(opts.caps, 'view_all') || hasRevopsCap(opts.caps, 'manage');
  const hasTeam = hasRevopsCap(opts.caps, 'view_team') || hasAll;
  const raw = opts.requested?.trim();
  if (raw === 'me') return 'me';
  if (raw === 'all' && hasAll) return 'all';
  if (raw === 'team' && hasTeam) return 'team';
  if (raw === 'all' || raw === 'team') return hasTeam ? 'team' : 'me';
  if (hasAll) return 'all';
  if (hasTeam) return 'team';
  return 'me';
}

export function resolveRevopsBuFilter(opts: {
  scope: RevopsScope;
  requestedBu?: string;
}): string | undefined {
  const bu = opts.requestedBu?.trim();
  if (!bu) return undefined;
  if (opts.scope === 'all' || opts.scope === 'team') return bu;
  return undefined;
}
