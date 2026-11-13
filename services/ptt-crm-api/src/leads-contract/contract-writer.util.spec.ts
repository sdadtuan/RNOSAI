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

  it('allows a Marketing Leader to create when no owner is recorded', () => {
    expect(canWriteLeadContract({ positionCode: 'mkl' })).toBe(true);
    expect(canWriteLeadContract({ positionCode: 'mkt-01' })).toBe(true);
  });

  it('allows the assigned AM who made the quote, and blocks another AM', () => {
    expect(
      canWriteLeadContract({
        positionCode: 'acm',
        actorStaffId: 108,
        quoteAssigneeStaffId: 108,
      }),
    ).toBe(true);
    expect(
      canWriteLeadContract({
        positionCode: 'acm',
        actorStaffId: 201,
        quoteAssigneeStaffId: 108,
        solutionOwnerStaffId: 108,
      }),
    ).toBe(false);
  });

  it('blocks Sales even when they try to draft after CEO approval', () => {
    expect(
      canWriteLeadContract({
        positionCode: 'ae',
        actorStaffId: 107,
        quoteAssigneeStaffId: 108,
      }),
    ).toBe(false);
  });
});
