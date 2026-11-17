import { assignedAmShouldReplace, effectiveAssignedAmId } from './assigned-am.util';

describe('assigned-am.util', () => {
  it('treats missing or zero assigned_am as empty', () => {
    expect(effectiveAssignedAmId(null, 7)).toBeNull();
    expect(effectiveAssignedAmId(0, 7)).toBeNull();
    expect(effectiveAssignedAmId(undefined, 7)).toBeNull();
    expect(assignedAmShouldReplace(null, 7)).toBe(true);
  });

  it('hides assigned_am when it still equals the Sales owner', () => {
    expect(effectiveAssignedAmId(7, 7)).toBeNull();
    expect(assignedAmShouldReplace(7, 7)).toBe(true);
  });

  it('keeps a real AM that is not the Sales owner', () => {
    expect(effectiveAssignedAmId(21, 7)).toBe(21);
    expect(assignedAmShouldReplace(21, 7)).toBe(false);
    expect(effectiveAssignedAmId(21, null)).toBe(21);
  });
});
