import { describe, expect, it } from 'vitest';
import { rightsStatus } from './cp-format';

describe('rightsStatus', () => {
  it('returns null when expiry is missing', () => {
    expect(rightsStatus(null, '2026-09-07')).toBeNull();
  });

  it('blocks an expiry before today', () => {
    expect(rightsStatus('2020-01-01', '2026-09-07')).toBe('block');
  });

  it('warns for an expiry within fourteen calendar days', () => {
    expect(rightsStatus('2026-09-12', '2026-09-07')).toBe('warn');
  });

  it('is ok after the warning window', () => {
    expect(rightsStatus('2026-09-22', '2026-09-07')).toBe('ok');
  });
});
