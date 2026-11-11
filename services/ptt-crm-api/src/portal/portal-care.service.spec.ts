import { ForbiddenException } from '@nestjs/common';
import { staffCanViewCareCase } from './portal-care.util';

/** Mirrors PortalCareService.requireActor guard (staff GET/mutations on cases). */
function assertCaseActor(
  user: { role: string; sub: string },
  row: { assignee_user_id: string | null },
): void {
  if (!staffCanViewCareCase(user, row.assignee_user_id)) {
    throw new ForbiddenException({ error: 'not_assignee' });
  }
}

describe('portal care staff assignee guard', () => {
  const staff = { role: 'staff', sub: 's1' };

  it('allows staff on their assigned case', () => {
    expect(() => assertCaseActor(staff, { assignee_user_id: 's1' })).not.toThrow();
  });

  it('forbids staff on another assignee', () => {
    expect(() => assertCaseActor(staff, { assignee_user_id: 's2' })).toThrow(ForbiddenException);
    try {
      assertCaseActor(staff, { assignee_user_id: 's2' });
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'not_assignee' });
    }
  });

  it('forbids staff on unassigned cases', () => {
    expect(() => assertCaseActor(staff, { assignee_user_id: null })).toThrow(ForbiddenException);
  });

  it('allows approver/viewer on unassigned', () => {
    expect(() => assertCaseActor({ role: 'approver', sub: 'm1' }, { assignee_user_id: null })).not.toThrow();
    expect(() => assertCaseActor({ role: 'viewer', sub: 'v1' }, { assignee_user_id: null })).not.toThrow();
  });
});
