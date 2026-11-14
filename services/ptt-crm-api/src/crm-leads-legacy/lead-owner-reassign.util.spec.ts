import { isLeadOwnerReassignKind, presalesOwnerColumn } from './lead-owner-reassign.util';

describe('lead-owner-reassign.util', () => {
  it('accepts the supported kinds and rejects others', () => {
    expect(isLeadOwnerReassignKind('sales')).toBe(true);
    expect(isLeadOwnerReassignKind('am')).toBe(true);
    expect(isLeadOwnerReassignKind('acm')).toBe(true);
    expect(isLeadOwnerReassignKind('solution')).toBe(true);
    expect(isLeadOwnerReassignKind('quote_am')).toBe(true);
    expect(isLeadOwnerReassignKind('owner')).toBe(false);
  });

  it('maps AM/ACM, marketing solution, and quote AM to existing presales columns', () => {
    expect(presalesOwnerColumn('sales')).toBeNull();
    expect(presalesOwnerColumn('am')).toBe('assigned_am');
    expect(presalesOwnerColumn('acm')).toBe('assigned_am');
    expect(presalesOwnerColumn('solution')).toBe('assigned_am');
    expect(presalesOwnerColumn('quote_am')).toBe('quote_assignee_staff_id');
  });
});