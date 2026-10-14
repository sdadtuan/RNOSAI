import { membershipLeadIds } from './staff-org-lead.util';

describe('membershipLeadIds', () => {
  it('keeps a requested lead only when that team stays on the user', () => {
    expect(membershipLeadIds([4, 9], [9, 3], [4])).toEqual([9]);
  });

  it('keeps the current lead when the request does not mention leads', () => {
    expect(membershipLeadIds([4, 9], undefined, [4])).toEqual([4]);
  });

  it('clears the lead when the team is removed', () => {
    expect(membershipLeadIds([9], [], [4])).toEqual([]);
  });
});
