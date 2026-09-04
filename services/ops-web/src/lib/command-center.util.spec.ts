import { describe, expect, it } from 'vitest';
import { applyDataIssuePrecedence, deltaPct, tileCodesFor } from './command-center.util';

describe('tileCodesFor', () => {
  it('executive uses SAL_008 and SAL_005 not SAL_002 or FIN_001', () => {
    expect(tileCodesFor('executive')).toEqual([
      'SAL_008', 'SAL_005', 'MKT_002', 'MKT_006', 'MKT_008', 'SAL_007',
    ]);
    expect(tileCodesFor('executive')).not.toContain('SAL_002');
    expect(tileCodesFor('executive')).not.toContain('FIN_001');
  });

  it('marketing includes MKT_009', () => {
    expect(tileCodesFor('marketing')).toContain('MKT_009');
  });
});

describe('deltaPct', () => {
  it('returns null when either side missing', () => {
    expect(deltaPct(10, null)).toBeNull();
    expect(deltaPct(null, 10)).toBeNull();
    expect(deltaPct(110, 100)).toBe(10);
  });
});

describe('applyDataIssuePrecedence', () => {
  it('Failed or DQ critical beats ACHIEVED', () => {
    expect(applyDataIssuePrecedence('ACHIEVED', 'FAILED', false)).toBe('DATA_ISSUE');
    expect(applyDataIssuePrecedence('ACHIEVED', 'FRESH', true)).toBe('DATA_ISSUE');
    expect(applyDataIssuePrecedence('ACHIEVED', 'FRESH', false)).toBe('ACHIEVED');
  });
});
