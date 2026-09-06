import { resolveCpScope } from './cp-scope.util';

it('downgrades all to me without view_all', () => {
  expect(resolveCpScope({ requested: 'all', hasViewAll: false, canTeam: false })).toBe('me');
});
