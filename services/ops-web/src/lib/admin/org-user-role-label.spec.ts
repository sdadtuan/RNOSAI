import { describe, expect, it } from 'vitest';
import { formatOrgUserRole } from './org-user-role-label';

describe('formatOrgUserRole', () => {
  it('shows the position team when the user has no team of their own', () => {
    expect(
      formatOrgUserRole({
        position_id: 8,
        position_code: 'AE',
        position_team_name: 'Account Management',
        job_functions: ['sales'],
      }),
    ).toBe('AE · Account Management · sales');
  });

  it('prefers the team saved on the user after a position change', () => {
    expect(
      formatOrgUserRole({
        position_id: 7,
        position_code: 'ACM',
        team_names: ['Account Management'],
        position_team_name: 'Agency Marketing',
        job_functions: ['leader'],
      }),
    ).toBe('ACM · Account Management · leader');
  });
});
