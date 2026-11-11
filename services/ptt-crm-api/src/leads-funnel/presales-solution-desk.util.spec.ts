import {
  canClaimSolutionCase,
  grandfatheredMarketingLeaderOwner,
  holdsSolutionDesk,
} from './presales-solution-desk.util';
import { holdsQuoteDesk } from './quote-case.util';

describe('presales solution desk', () => {
  it('allows AM to claim solution cases', () => {
    expect(holdsSolutionDesk('kd-01')).toBe(true);
    expect(canClaimSolutionCase('acm')).toBe(true);
    expect(canClaimSolutionCase('mkl')).toBe(false);
    expect(canClaimSolutionCase('ae', { canReceiveSolution: true })).toBe(true);
    expect(canClaimSolutionCase('ae', { canReceiveSolution: false })).toBe(false);
  });

  it('grandfathers in-flight MKL quote owners', () => {
    expect(grandfatheredMarketingLeaderOwner('mkl')).toBe(true);
    expect(holdsQuoteDesk('am', { position_code: 'MKL' })).toBe(false);
  });
});
