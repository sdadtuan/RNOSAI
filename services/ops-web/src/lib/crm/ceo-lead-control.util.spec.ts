import { describe, expect, it } from 'vitest';
import { ceoLeadListParams, ceoLeadStatusFilter } from './ceo-lead-control.util';

describe('ceoLeadListParams', () => {
  it('asks for every lead when filters are open', () => {
    expect(
      ceoLeadListParams({
        statusId: 'all',
        flow: 'all',
        situation: 'all',
        limit: 50,
        offset: 0,
      }),
    ).toEqual({
      q: undefined,
      statuses: undefined,
      lead_flow_kind: undefined,
      hide_review_queue: false,
      review_queue_only: undefined,
      unassigned_only: undefined,
      assigned_only: undefined,
      limit: 50,
      offset: 0,
    });
  });

  it('includes new and moi when the desk filters Mới', () => {
    const params = ceoLeadListParams({
      statusId: 'moi',
      flow: 'b2b_prospect',
      situation: 'review',
      limit: 50,
      offset: 50,
    });
    expect(params.statuses).toEqual(expect.arrayContaining(['moi', 'new']));
    expect(params.lead_flow_kind).toBe('b2b_prospect');
    expect(params.review_queue_only).toBe(true);
    expect(params.hide_review_queue).toBe(false);
    expect(params.offset).toBe(50);
  });

  it('falls back to every status for an unknown chip', () => {
    expect(ceoLeadStatusFilter('nope').statuses).toEqual([]);
  });
});
