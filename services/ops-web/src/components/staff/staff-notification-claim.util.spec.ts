import { describe, expect, it } from 'vitest';
import { staffNotifyClaimKind, staffNotifyLeadId } from './staff-notification-claim.util';

describe('staffNotifyClaimKind', () => {
  it('returns claim_case when meta.action is set', () => {
    const n = {
      kind: 'presales_solution',
      title: 'Case Solutions chờ AM nhận',
      read: false,
      meta_json: { lead_id: 42, action: 'claim_case', accept_minutes: 15 },
    };
    expect(staffNotifyLeadId(n)).toBe(42);
    expect(staffNotifyClaimKind(n)).toBe('claim_case');
  });

  it('falls back to claim_case for legacy AM handoff notifies', () => {
    const n = {
      kind: 'presales_solution',
      title: 'Case Solutions chờ AM nhận',
      read: false,
      meta_json: { lead_id: 99, accept_minutes: 15 },
    };
    expect(staffNotifyClaimKind(n)).toBe('claim_case');
  });

  it('keeps claim_lead for sales receipt notifies', () => {
    const n = {
      kind: 'sales_claim',
      title: 'Lead mới chờ nhận',
      read: false,
      meta_json: { lead_id: 7, action: 'claim_lead' },
    };
    expect(staffNotifyClaimKind(n)).toBe('claim_lead');
  });

  it('hides the action once the notify is read', () => {
    const n = {
      kind: 'presales_solution',
      title: 'Case Solutions chờ AM nhận',
      read: true,
      meta_json: { lead_id: 42, action: 'claim_case' },
    };
    expect(staffNotifyClaimKind(n)).toBeNull();
  });
});
