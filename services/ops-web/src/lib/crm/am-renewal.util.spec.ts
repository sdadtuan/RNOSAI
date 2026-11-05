import { describe, expect, it } from 'vitest';
import { AM_RENEWAL_COLUMNS, amRenewalLostError } from './am-renewal.util';

describe('am-renewal', () => {
  it('uses the four kanban column labels', () => {
    expect(AM_RENEWAL_COLUMNS.map((col) => col.label)).toEqual([
      'Chưa bắt đầu',
      'Đang đánh giá',
      'Đàm phán',
      'Đã quyết định',
    ]);
  });

  it('amRenewalLostError when reason, date, or lessons are blank', () => {
    expect(amRenewalLostError({ lost_reason: '', lost_on: '2026-10-12', lessons: 'price' })).toBe(
      'lost_fields_required',
    );
    expect(amRenewalLostError({ lost_reason: 'price', lost_on: '', lessons: 'price' })).toBe(
      'lost_fields_required',
    );
    expect(amRenewalLostError({ lost_reason: 'price', lost_on: '2026-10-12', lessons: '   ' })).toBe(
      'lost_fields_required',
    );
    expect(
      amRenewalLostError({ lost_reason: 'price', lost_on: '2026-10-12', lessons: 'budget cut' }),
    ).toBeNull();
  });
});
