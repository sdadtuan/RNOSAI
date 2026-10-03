import {
  isLeadInReviewQueue,
  normalizeB2ContactDeadlineHours,
  reviewQueueAssignmentClockSql,
  reviewQueuePublicState,
} from './review-queue.util';

describe('review-queue.util', () => {
  it('normalizes deadline hours', () => {
    expect(normalizeB2ContactDeadlineHours(24)).toBe(24);
    expect(normalizeB2ContactDeadlineHours(999)).toBe(168);
    expect(normalizeB2ContactDeadlineHours('bad')).toBe(24);
  });

  it('measures the B2 clock from the current owner assignment', () => {
    const sql = reviewQueueAssignmentClockSql('l');
    expect(sql).toContain('al.to_owner_id = l.owner_id');
    expect(sql).toContain('al.created_at >= l.created_at');
    expect(sql).toContain('ORDER BY al.created_at DESC');
    expect(sql).not.toContain('ORDER BY al.created_at ASC');
  });

  it('detects active review queue in meta', () => {
    expect(isLeadInReviewQueue({ review_queue: { active: true } })).toBe(true);
    expect(isLeadInReviewQueue({})).toBe(false);
  });

  it('builds public review queue state', () => {
    const state = reviewQueuePublicState(
      {
        review_queue: {
          active: true,
          queued_at: '2026-07-23 10:00:00',
          assigned_at: '2026-07-22 10:00:00',
          deadline_hours: 24,
        },
      },
      '',
      new Date('2026-07-23T12:00:00Z'),
    );
    expect(state.active).toBe(true);
    expect(state.deadline_hours).toBe(24);
  });
});
