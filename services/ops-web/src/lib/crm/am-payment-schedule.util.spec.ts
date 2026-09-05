import { describe, expect, it } from 'vitest';
import { amPaymentStatusCopy } from './am-payment-schedule.util';

describe('amPaymentStatusCopy', () => {
  it('maps upcoming and overdue and never paid', () => {
    expect(amPaymentStatusCopy('upcoming')).toBe('Sắp tới');
    expect(amPaymentStatusCopy('overdue')).toBe('Quá hạn');
    expect(amPaymentStatusCopy('upcoming')).not.toBe('Đã thu');
  });
});
