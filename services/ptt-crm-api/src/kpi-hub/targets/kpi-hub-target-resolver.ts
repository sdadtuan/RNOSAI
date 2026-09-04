export type HubHierarchyLevel = 'WORKSPACE' | 'DEPARTMENT' | 'TEAM' | 'CAMPAIGN' | 'USER';

export type HubScopeChain = {
  workspace?: string;
  department?: string;
  team?: string;
  campaign?: string;
  user?: string;
};

export type HubTargetCandidate = {
  id: string;
  hierarchy_level: HubHierarchyLevel;
  scope_hash: string;
  scope_label: string;
  target_value: number;
  warning_value: number | null;
  critical_value: number | null;
  direction: string;
};

const LEVEL_PRIORITY: HubHierarchyLevel[] = ['CAMPAIGN', 'USER', 'TEAM', 'DEPARTMENT', 'WORKSPACE'];

/**
 * Resolve the most specific target for a KPI period.
 * Campaign/User > Team > Department > Workspace (SRS AC-23).
 */
export function resolveTarget(
  candidates: HubTargetCandidate[],
  scope: HubScopeChain,
): HubTargetCandidate | null {
  if (!candidates.length) return null;

  const matches = candidates.filter((c) => targetMatchesScope(c, scope));
  if (!matches.length) {
    const workspace = candidates.find((c) => c.hierarchy_level === 'WORKSPACE');
    return workspace ?? null;
  }

  for (const level of LEVEL_PRIORITY) {
    const hit = matches.find((c) => c.hierarchy_level === level);
    if (hit) return hit;
  }
  return matches[0];
}

function targetMatchesScope(target: HubTargetCandidate, scope: HubScopeChain): boolean {
  switch (target.hierarchy_level) {
    case 'CAMPAIGN':
      return Boolean(scope.campaign && target.scope_label.includes(scope.campaign));
    case 'USER':
      return Boolean(scope.user && target.scope_label.includes(scope.user));
    case 'TEAM':
      return Boolean(scope.team && target.scope_label.includes(scope.team));
    case 'DEPARTMENT':
      return Boolean(scope.department && target.scope_label.includes(scope.department));
    case 'WORKSPACE':
      return true;
    default:
      return false;
  }
}

export function scopeHashFromChain(scope: HubScopeChain): string {
  const parts = [
    scope.campaign ? `c:${scope.campaign}` : '',
    scope.user ? `u:${scope.user}` : '',
    scope.team ? `t:${scope.team}` : '',
    scope.department ? `d:${scope.department}` : '',
    'w:default',
  ].filter(Boolean);
  return parts.join('|');
}
