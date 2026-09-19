import {
  dueDateFromDays,
  mergeAssignmentIntoFormData,
  normalizeDueDate,
  normalizePriority,
  readAssignmentFields,
} from './svc-task-assignment.util';

describe('svc-task-assignment.util', () => {
  it('reads assignee/priority/due from form_data aliases', () => {
    expect(
      readAssignmentFields({
        owner: 'Lê Hoàng',
        priority: 'HIGH',
        due_at: '2026-10-05T12:00:00.000Z',
      }),
    ).toEqual({
      assignee: 'Lê Hoàng',
      assignee_staff_id: null,
      priority: 'high',
      due_date: '2026-10-05',
    });
  });

  it('merges assignment patch into form_data', () => {
    const next = mergeAssignmentIntoFormData(
      { ai_draft: true, role_key: 'content' },
      { assignee: 'AM 360', priority: 'urgent', due_date: '2026-10-12' },
    );
    expect(next).toMatchObject({
      ai_draft: true,
      role_key: 'content',
      assignee: 'AM 360',
      owner: 'AM 360',
      priority: 'urgent',
      due_date: '2026-10-12',
    });
  });

  it('normalizes priority and due', () => {
    expect(normalizePriority('urgent')).toBe('urgent');
    expect(normalizePriority('nope')).toBeUndefined();
    expect(normalizeDueDate('2026-09-20')).toBe('2026-09-20');
    expect(normalizeDueDate(null)).toBeNull();
  });

  it('computes due from days', () => {
    expect(dueDateFromDays(3, new Date('2026-09-20T00:00:00.000Z'))).toBe('2026-09-23');
  });
});
