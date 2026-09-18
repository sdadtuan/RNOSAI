import {
  filterBulkAcceptCandidates,
  selectIdsByReadiness,
} from './bulk-accept.util';

describe('bulk-accept.util', () => {
  it('filters out pushed, rejected, missing, dup', () => {
    const out = filterBulkAcceptCandidates([
      { id: 1, status: 'pending', readiness_status: 'NEEDS_REVIEW' },
      { id: 2, status: 'pending', readiness_status: 'MISSING_CONTACT' },
      { id: 3, status: 'pushed', readiness_status: 'READY_TO_PUSH' },
      { id: 4, status: 'pending', readiness_status: 'READY_TO_PUSH' },
      { id: 5, status: 'rejected', readiness_status: 'NEEDS_REVIEW' },
    ]);
    expect(out.map((l) => l.id)).toEqual([1, 4]);
  });

  it('selects ids by readiness on page', () => {
    const leads = [
      { id: 1, readiness_status: 'READY_TO_PUSH', status: 'pending' },
      { id: 2, readiness_status: 'NEEDS_REVIEW', status: 'pending' },
      { id: 3, readiness_status: 'READY_TO_PUSH', status: 'pushed' },
    ];
    expect(selectIdsByReadiness(leads, 'READY_TO_PUSH')).toEqual([1]);
    expect(selectIdsByReadiness(leads, 'NEEDS_REVIEW')).toEqual([2]);
  });
});
