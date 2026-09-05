import { describe, expect, it } from 'vitest';
import {
  AM_HANDOVER_CHECKLIST,
  AM_HANDOVER_STEPS,
  amHandoverCanAccept,
  amHandoverReasonError,
  amHandoverStatusCopy,
} from './am-handover.util';

describe('am-handover', () => {
  it('uses four AM steps Thương mại → Scope & KPI → Stakeholder → Xác nhận', () => {
    expect(AM_HANDOVER_STEPS.map((step) => step.label)).toEqual([
      'Thương mại',
      'Scope & KPI',
      'Stakeholder',
      'Xác nhận',
    ]);
    expect(AM_HANDOVER_CHECKLIST).toHaveLength(3);
  });

  it('blocks accept until every required AM checklist item is ticked', () => {
    expect(amHandoverCanAccept({})).toBe(false);
    expect(amHandoverCanAccept({ understood_scope: true })).toBe(false);
    expect(
      amHandoverCanAccept({
        understood_scope: true,
        stakeholders_access: true,
        delivery_owner: true,
      }),
    ).toBe(true);
  });

  it('requires a reason for reject and needs_info', () => {
    expect(amHandoverReasonError('reject', '')).toBe('reason_required');
    expect(amHandoverReasonError('needs_info', '   ')).toBe('reason_required');
    expect(amHandoverReasonError('reject', 'Thiếu KPI')).toBe('');
    expect(amHandoverReasonError('accept', '')).toBe('');
    expect(amHandoverStatusCopy('pending_am')).toBe('Chờ AM xác nhận');
  });
});
