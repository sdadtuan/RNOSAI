import {
  canUseAssignedSolutionAction,
  isSolutionPoolMember,
} from './solution-assignee-access.util';

describe('isSolutionPoolMember', () => {
  it('includes only Nhận Solution staff, not AM position alone', () => {
    expect(isSolutionPoolMember({})).toBe(false);
    expect(isSolutionPoolMember({ canReceiveSolution: true })).toBe(true);
  });
});

describe('canUseAssignedSolutionAction', () => {
  it('allows grandfathered assignee without pool membership', () => {
    expect(
      canUseAssignedSolutionAction({
        staffId: 5,
        assigneeStaffId: 5,
        isAccountManager: true,
        canReceiveSolution: false,
      }),
    ).toBe(true);
  });
});