import { describe, expect, it } from 'vitest';
import { quoteRoleLabel, quoteUnitLabel } from './quote-unit-label';

describe('quoteUnitLabel', () => {
  it('maps catalog units to Vietnamese', () => {
    expect(quoteUnitLabel('times')).toBe('lần');
    expect(quoteUnitLabel('1 times'.split(' ')[1])).toBe('lần');
    expect(quoteUnitLabel('month')).toBe('tháng');
    expect(quoteUnitLabel('shoot_day')).toBe('ngày quay');
    expect(quoteUnitLabel('hours')).toBe('giờ');
    expect(quoteUnitLabel('lần')).toBe('lần');
    expect(quoteUnitLabel('')).toBe('');
    expect(quoteUnitLabel(undefined)).toBe('');
  });

  it('maps the Account role to AM', () => {
    expect(quoteRoleLabel('Account')).toBe('AM');
    expect(quoteRoleLabel('account')).toBe('AM');
    expect(quoteRoleLabel('AM')).toBe('AM');
    expect(quoteRoleLabel('Chiến lược')).toBe('Chiến lược');
    expect(quoteRoleLabel('')).toBe('');
  });
});
