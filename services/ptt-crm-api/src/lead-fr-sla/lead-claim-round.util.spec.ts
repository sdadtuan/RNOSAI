import { amCannotClaimSalesLead } from './lead-claim-round.util';

describe('amCannotClaimSalesLead', () => {
  it('blocks the AM role and still allows Sales and Super Admin', () => {
    expect(amCannotClaimSalesLead(true, false)).toBe(true);
    expect(amCannotClaimSalesLead(false, false)).toBe(false);
    expect(amCannotClaimSalesLead(true, true)).toBe(false);
  });
});
