import { amScopeSql, resolveAmScope } from './am-scope.util';

describe('am-scope.util', () => {
  it('downgrades all without view_all to me', () => {
    expect(resolveAmScope({ requested: 'all', hasViewAll: false, canTeam: false })).toBe('me');
  });

  it('allows all when view_all is present', () => {
    expect(resolveAmScope({ requested: 'all', hasViewAll: true, canTeam: true })).toBe('all');
  });

  it('produces SQL fragments for each scope', () => {
    expect(amScopeSql({ scope: 'all', staffId: 3, teamIds: [1] })).toEqual({ sql: 'TRUE', params: [] });
    expect(amScopeSql({ scope: 'team', staffId: 3, teamIds: [] })).toEqual({
      sql: 'e.account_owner_staff_id = $staff',
      params: [3],
    });
    expect(amScopeSql({ scope: 'team', staffId: 3, teamIds: [9, 8] })).toEqual({
      sql: '(e.team_id = ANY($teams) OR e.account_owner_staff_id = $staff)',
      params: [[9, 8], 3],
    });
    expect(amScopeSql({ scope: 'me', staffId: 3, teamIds: [] }).sql).toContain(
      "t.status NOT IN ('closed','cancelled')",
    );
  });
});
