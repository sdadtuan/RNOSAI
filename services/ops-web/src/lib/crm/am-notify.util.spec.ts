import { describe, expect, it } from 'vitest';
import { amNotifyKindLabel, showAmNotifyDot } from './am-notify.util';

describe('showAmNotifyDot', () => {
  it('shows the bell dot only when unread is greater than 0', () => {
    expect(showAmNotifyDot(0)).toBe(false);
    expect(showAmNotifyDot(1)).toBe(true);
    expect(showAmNotifyDot(3)).toBe(true);
  });

  it('never treats a hard-coded 5 as the default unread count', () => {
    expect(showAmNotifyDot(5)).toBe(true);
    expect(showAmNotifyDot(0)).not.toBe(true);
  });
});

describe('amNotifyKindLabel', () => {
  it('labels the four AM kinds', () => {
    expect(amNotifyKindLabel('sla.breached')).toBe('SLA');
    expect(amNotifyKindLabel('renewal.ending')).toBe('Gia hạn');
    expect(amNotifyKindLabel('health.drop')).toBe('Health');
    expect(amNotifyKindLabel('invoice.paid')).toBe('Hóa đơn');
  });
});
