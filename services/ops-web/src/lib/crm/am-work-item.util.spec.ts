import { describe, expect, it } from 'vitest';
import { amWorkItemBreached, amWorkItemErrorCopy } from './am-work-item.util';

describe('am-work-item', () => {
  it('amWorkItemBreached is true only when overdue and not paused', () => {
    expect(amWorkItemBreached({ overdue: true, sla_paused: false })).toBe(true);
    expect(amWorkItemBreached({ overdue: true, sla_paused: true })).toBe(false);
    expect(amWorkItemBreached({ overdue: false, sla_paused: false })).toBe(false);
    expect(amWorkItemBreached({ overdue: false, sla_paused: true })).toBe(false);
  });

  it('maps waiting / resolve / escalate 400 codes', () => {
    expect(amWorkItemErrorCopy('reason_required')).toMatch(/lý do|reason/i);
    expect(amWorkItemErrorCopy('summary_required')).toMatch(/tóm tắt|summary/i);
    expect(amWorkItemErrorCopy('category_required')).toMatch(/category|phân loại/i);
    expect(amWorkItemErrorCopy('invalid_level')).toMatch(/cấp|level/i);
    expect(amWorkItemErrorCopy('invalid_recipient_staff_id')).toMatch(/nhận|recipient/i);
  });
});
