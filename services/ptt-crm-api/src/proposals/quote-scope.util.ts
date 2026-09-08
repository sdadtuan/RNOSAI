import type { QuoteScope } from './quote.types';

export type { QuoteScope };

export function resolveQuoteScope(opts: {
  requested: QuoteScope | undefined;
  hasViewAll: boolean;
  canTeam: boolean;
}): QuoteScope {
  const requested = opts.requested ?? 'me';
  if (requested === 'all' && opts.hasViewAll) return 'all';
  if (requested === 'team' && (opts.canTeam || opts.hasViewAll)) return 'team';
  return 'me';
}

export function qtScopeSql(opts: {
  scope: QuoteScope;
  staffId: number;
  teamIds: number[];
}): { sql: string; params: unknown[] } {
  if (opts.scope === 'all') return { sql: 'TRUE', params: [] };
  const meSql = `(p.owner_staff_id = $staff OR p.co_owner_staff_ids @> to_jsonb($staff::int))`;
  if (opts.scope === 'team' && opts.teamIds.length) {
    return {
      sql: `(${meSql} OR EXISTS (
  SELECT 1
    FROM crm_staff owner
    JOIN staff_users u ON lower(trim(u.email)) = lower(trim(owner.email))
    JOIN staff_user_teams sut ON sut.user_id = u.id
   WHERE owner.id = p.owner_staff_id AND sut.team_id = ANY($teams)
))`,
      params: [opts.staffId, opts.teamIds],
    };
  }
  return { sql: meSql, params: [opts.staffId] };
}
