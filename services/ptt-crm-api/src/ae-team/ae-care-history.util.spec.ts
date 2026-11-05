import { careHistoryEventLabel, careHistoryReason } from './ae-care-history.util';

describe('care history labels', () => {
  it('names assign, recall, and current hold', () => {
    expect(careHistoryEventLabel('assigned')).toBe('Đã gán');
    expect(careHistoryEventLabel('recalled')).toBe('Bị thu hồi');
    expect(careHistoryEventLabel('holding')).toBe('Đang giữ');
  });

  it('keeps a Vietnamese reason and hides an internal code', () => {
    expect(careHistoryReason('Phân lại lead: CSKH')).toBe('Phân lại lead: CSKH');
    expect(careHistoryReason('pre_b2_hold_expired')).toBe('Hết hạn giữ, chuyển người');
    expect(careHistoryReason('')).toBe('');
  });
});