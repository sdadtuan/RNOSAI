import {
  offsetForPage,
  parseRawLeadListQuery,
  totalPages,
} from './raw-lead-list-query.util';

describe('raw-lead-list-query.util', () => {
  it('computes total_pages and offset for page_size 50', () => {
    expect(totalPages(0, 50)).toBe(0);
    expect(totalPages(1, 50)).toBe(1);
    expect(totalPages(50, 50)).toBe(1);
    expect(totalPages(51, 50)).toBe(2);
    expect(offsetForPage(1, 50)).toBe(0);
    expect(offsetForPage(3, 50)).toBe(100);
  });

  it('parses filters with defaults and clamps', () => {
    const q = parseRawLeadListQuery({
      page: '2',
      page_size: '50',
      status: 'pending,accepted',
      has_phone: '1',
      q: ' spa ',
      include_auto_rejected: '1',
    });
    expect(q.page).toBe(2);
    expect(q.page_size).toBe(50);
    expect(q.status).toEqual(['pending', 'accepted']);
    expect(q.has_phone).toBe(true);
    expect(q.q).toBe('spa');
    expect(q.include_auto_rejected).toBe(true);

    expect(parseRawLeadListQuery({ page_size: '999' }).page_size).toBe(100);
    expect(parseRawLeadListQuery({ page: '0' }).page).toBe(1);
    expect(parseRawLeadListQuery({}).page_size).toBe(50);
    expect(parseRawLeadListQuery({}).include_auto_rejected).toBe(false);
  });

  it('parses readiness_status filter', () => {
    expect(
      parseRawLeadListQuery({ readiness_status: 'ready_to_push' }).readiness_status,
    ).toBe('READY_TO_PUSH');
    expect(
      parseRawLeadListQuery({ readiness_status: 'NEEDS_REVIEW' }).readiness_status,
    ).toBe('NEEDS_REVIEW');
    expect(parseRawLeadListQuery({ readiness_status: 'bogus' }).readiness_status).toBeUndefined();
  });

  it('parses priority_tier filter', () => {
    expect(parseRawLeadListQuery({ priority_tier: 'p1' }).priority_tier).toBe('P1');
    expect(parseRawLeadListQuery({ priority_tier: 'P3' }).priority_tier).toBe('P3');
    expect(parseRawLeadListQuery({ priority_tier: 'P9' }).priority_tier).toBeUndefined();
  });
});
