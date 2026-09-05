import type { AmScope } from './am.types';

export type { AmScope };

export function resolveAmScope(opts: {
  requested: AmScope | undefined;
  hasViewAll: boolean;
  canTeam: boolean;
}): AmScope {
  const req = opts.requested ?? 'me';
  if (req === 'all' && opts.hasViewAll) return 'all';
  if (req === 'team' && (opts.canTeam || opts.hasViewAll)) return 'team';
  return 'me';
}

export function amScopeSql(opts: {
  scope: AmScope;
  staffId: number;
  teamIds: number[];
}): { sql: string; params: unknown[] } {
  if (opts.scope === 'all') return { sql: 'TRUE', params: [] };
  if (opts.scope === 'team') {
    if (!opts.teamIds.length) {
      return { sql: 'e.account_owner_staff_id = $staff', params: [opts.staffId] };
    }
    return {
      sql: '(e.team_id = ANY($teams) OR e.account_owner_staff_id = $staff)',
      params: [opts.teamIds, opts.staffId],
    };
  }
  return {
    sql: "(e.account_owner_staff_id = $staff OR EXISTS (SELECT 1 FROM crm_am_tasks t WHERE t.agency_client_id = e.agency_client_id AND t.assignee_staff_id = $staff AND t.status NOT IN ('closed','cancelled')))",
    params: [opts.staffId],
  };
}
