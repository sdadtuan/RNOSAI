import { decideSolutionAssignee } from './solution-auto-assign.util';

describe('decideSolutionAssignee', () => {
  const base = { assignedAm: null, assignedAmInPool: false, lastOwner: null, lastOwnerInPool: false, lastAutoStaffId: null };

  it('keeps assigned_am when it is already in the pool', () => {
    expect(decideSolutionAssignee({ ...base, assignedAm: 7, assignedAmInPool: true, poolIds: [3, 7, 9] })).toEqual({
      action: 'keep',
      staffId: 7,
      why: 'assigned_in_pool',
    });
  });

  it('round-robins the pool when assigned_am is the Sales owner', () => {
    const first = decideSolutionAssignee({ ...base, assignedAm: 42, poolIds: [9, 3, 7] });
    expect(first).toEqual({ action: 'assign', staffId: 3, why: 'round_robin' });
    const second = decideSolutionAssignee({ ...base, assignedAm: 42, poolIds: [9, 3, 7], lastAutoStaffId: 3 });
    expect(second.staffId).toBe(7);
    const third = decideSolutionAssignee({ ...base, assignedAm: 42, poolIds: [9, 3, 7], lastAutoStaffId: 7 });
    expect(third.staffId).toBe(9);
    const wrap = decideSolutionAssignee({ ...base, assignedAm: 42, poolIds: [9, 3, 7], lastAutoStaffId: 9 });
    expect(wrap.staffId).toBe(3);
  });

  it('starts at the lowest id when the last pick has left the pool', () => {
    expect(decideSolutionAssignee({ ...base, poolIds: [5, 8], lastAutoStaffId: 99 }).staffId).toBe(5);
  });

  it('returns no change on an empty pool', () => {
    expect(decideSolutionAssignee({ ...base, assignedAm: 42, poolIds: [] })).toEqual({
      action: 'none',
      staffId: null,
      why: 'empty_pool',
    });
  });

  it('keeps the existing reclaim path when there is no assigned_am but the previous owner is in the pool', () => {
    expect(decideSolutionAssignee({ ...base, lastOwner: 7, lastOwnerInPool: true, poolIds: [3, 7] })).toEqual({
      action: 'keep',
      staffId: 7,
      why: 'reclaim_previous',
    });
  });

  it('gives a resubmitted lead back to its previous pool owner instead of rotating', () => {
    expect(
      decideSolutionAssignee({ ...base, assignedAm: 42, lastOwner: 7, lastOwnerInPool: true, poolIds: [3, 7, 9] }),
    ).toEqual({ action: 'assign', staffId: 7, why: 'previous_owner' });
  });
});
