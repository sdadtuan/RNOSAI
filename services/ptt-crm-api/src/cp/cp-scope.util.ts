import type { CpScope } from './cp.types';

export type { CpScope };

export function resolveCpScope(opts: {
  requested: CpScope | undefined;
  hasViewAll: boolean;
  canTeam: boolean;
}): CpScope {
  const requested = opts.requested ?? 'me';
  if (requested === 'all' && opts.hasViewAll) return 'all';
  if (requested === 'team' && (opts.canTeam || opts.hasViewAll)) return 'team';
  return 'me';
}

export function cpScopeSql(opts: {
  scope: CpScope;
  staffId: number;
  teamIds: number[];
}): { sql: string; params: unknown[] } {
  if (opts.scope === 'all') return { sql: 'TRUE', params: [] };
  if (opts.scope === 'team' && opts.teamIds.length) {
    return {
      sql: `(EXISTS (
  SELECT 1
    FROM crm_staff owner
    JOIN staff_users u ON lower(trim(u.email)) = lower(trim(owner.email))
    JOIN staff_user_teams sut ON sut.user_id = u.id
   WHERE owner.id = p.owner_staff_id AND sut.team_id = ANY($teams)
) OR EXISTS (
  SELECT 1
    FROM crm_cp_project_members m
    JOIN crm_staff member_staff ON member_staff.id = m.staff_id
    JOIN staff_users u ON lower(trim(u.email)) = lower(trim(member_staff.email))
    JOIN staff_user_teams sut ON sut.user_id = u.id
   WHERE m.project_id = p.id AND sut.team_id = ANY($teams)
))`,
      params: [opts.teamIds],
    };
  }
  return {
    sql: `(p.owner_staff_id = $staff OR EXISTS (
  SELECT 1 FROM crm_cp_project_members m
   WHERE m.project_id = p.id AND m.staff_id = $staff
))`,
    params: [opts.staffId],
  };
}
