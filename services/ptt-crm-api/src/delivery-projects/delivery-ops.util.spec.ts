import {
  computeDeliveryQuality,
  defaultApprovalPolicy,
  overlapAllocationPct,
} from './delivery-ops.util';

describe('overlapAllocationPct', () => {
  it('sums active and draft project allocations in range', () => {
    const pct = overlapAllocationPct(
      [
        { staff_id: 1, pct: 80, start: '2026-09-01', end: '2026-09-30', project_status: 'active' },
        { staff_id: 1, pct: 30, start: '2026-09-10', end: '2026-09-20', project_status: 'draft' },
        { staff_id: 1, pct: 50, start: '2026-09-01', end: '2026-09-30', project_status: 'cancelled' },
      ],
      1,
      { start: '2026-09-01', end: '2026-09-30' },
    );
    expect(pct).toBe(110);
  });
});

describe('computeDeliveryQuality', () => {
  it('returns null score when no milestones', () => {
    expect(computeDeliveryQuality({ milestones: [], changeRequestCount: 0 }).score).toBeNull();
  });

  it('computes on-time and rework from milestones and CR count', () => {
    const out = computeDeliveryQuality({
      milestones: [
        { status: 'done', due_date: '2026-09-10', completed_at: '2026-09-09' },
        { status: 'done', due_date: '2026-09-10', completed_at: '2026-09-12' },
        { status: 'planned', due_date: '2026-09-20', completed_at: null },
      ],
      changeRequestCount: 1,
    });
    expect(out.ontime_milestone_pct).toBe(50);
    expect(out.rework_pct).toBeCloseTo(33.3, 1);
    expect(out.score).not.toBeNull();
  });
});

describe('defaultApprovalPolicy', () => {
  it('includes finance when needs_finance', () => {
    expect(defaultApprovalPolicy(true).map((s) => s.role)).toEqual(['pm', 'delivery_director', 'finance']);
    expect(defaultApprovalPolicy(false).map((s) => s.role)).toEqual(['pm', 'delivery_director']);
  });
});
