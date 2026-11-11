import { canWriteLeadContract, isAccountExecutivePosition } from './contract-writer.util';

describe('contract writer RBAC', () => {
  it('allows AM and super-admin to create', () => {
    expect(canWriteLeadContract({ positionCode: 'KD-01' })).toBe(true);
    expect(canWriteLeadContract({ positionCode: 'acm' })).toBe(true);
    expect(canWriteLeadContract({ positionCode: 'ae', asSuperAdmin: true })).toBe(true);
  });

  it('blocks Sale from creating a new contract', () => {
    expect(canWriteLeadContract({ positionCode: 'ae', actorEmail: 'sale@ptt.vn' })).toBe(false);
    expect(isAccountExecutivePosition('AE')).toBe(true);
  });

  it('grandfathers the Sale who already created the draft', () => {
    expect(
      canWriteLeadContract({
        positionCode: 'ae',
        actorEmail: 'sale@ptt.vn',
        createdBy: 'sale@ptt.vn',
        allowGrandfather: true,
      }),
    ).toBe(true);
    expect(
      canWriteLeadContract({
        positionCode: 'ae',
        actorEmail: 'other@ptt.vn',
        createdBy: 'sale@ptt.vn',
        allowGrandfather: true,
      }),
    ).toBe(false);
  });
});
