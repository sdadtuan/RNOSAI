import { qtScopeSql, resolveQuoteScope } from './quote-scope.util';

describe('quote-scope.util', () => {
  it('downgrades all to me without view_all', () => {
    expect(resolveQuoteScope({ requested: 'all', hasViewAll: false, canTeam: false })).toBe('me');
  });

  it('allows all when view_all is present', () => {
    expect(resolveQuoteScope({ requested: 'all', hasViewAll: true, canTeam: true })).toBe('all');
  });

  it('produces SQL fragments for each scope', () => {
    expect(qtScopeSql({ scope: 'all', staffId: 3, teamIds: [1] })).toEqual({ sql: 'TRUE', params: [] });
    expect(qtScopeSql({ scope: 'me', staffId: 3, teamIds: [] }).sql).toContain('p.owner_staff_id = $staff');
    expect(qtScopeSql({ scope: 'team', staffId: 3, teamIds: [9, 8] }).sql).toMatch(/team_id = ANY\(\$teams\)/);
  });
});
