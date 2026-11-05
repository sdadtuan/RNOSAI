import { describe, expect, it } from 'vitest';
import {
  allocateEven,
  computeGrossMarginPct,
  financeApprovalRequired,
  internalCostFromItems,
  overlapAllocationPct,
  parseDecimal,
  validateManualAlloc,
} from './delivery-budget.util';

describe('parseDecimal', () => {
  it('rejects NaN and normalizes decimals', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('100.50')).toBe('100.50');
    expect(parseDecimal(100.5)).toBe('100.50');
  });
});

describe('internalCostFromItems', () => {
  it('excludes client-borne media from internal cost', () => {
    expect(
      internalCostFromItems([
        { amount: '100', kind: 'labor' },
        { amount: '50', kind: 'media', media_borne: 'client_borne' },
        { amount: '20', kind: 'media', media_borne: 'agency_borne' },
      ]),
    ).toBe('120.00');
  });
});

describe('computeGrossMarginPct', () => {
  it('margin uses contract minus internal minus contingency', () => {
    expect(computeGrossMarginPct({ contract: '1000', internalForecast: '600', contingency: '50' })).toBe('35');
  });

  it('returns null when contract is zero', () => {
    expect(computeGrossMarginPct({ contract: '0', internalForecast: '100', contingency: '0' })).toBeNull();
  });
});

describe('allocateEven', () => {
  it('even allocation dumps remainder on last period', () => {
    expect(allocateEven('100', ['2026-09', '2026-10', '2026-11']).map((r) => r.amount)).toEqual([
      '33.33',
      '33.33',
      '33.34',
    ]);
  });
});

describe('validateManualAlloc', () => {
  it('manual alloc must equal forecast', () => {
    expect(validateManualAlloc('100', [{ amount: '40' }, { amount: '59' }]).ok).toBe(false);
    expect(validateManualAlloc('100', [{ amount: '40' }, { amount: '60' }]).ok).toBe(true);
  });
});

describe('overlapAllocationPct', () => {
  it('overlap sums active+draft only', () => {
    const pct = overlapAllocationPct(
      [
        { staff_id: 1, pct: 80, start: '2026-09-01', end: '2026-09-30', project_status: 'active' },
        { staff_id: 1, pct: 30, start: '2026-09-10', end: '2026-09-20', project_status: 'draft' },
        { staff_id: 1, pct: 50, start: '2026-09-01', end: '2026-09-30', project_status: 'cancelled' },
      ],
      1,
      { start: '2026-09-01', end: '2026-09-30' },
    );
    expect(pct).toBe(110);
  });
});

describe('financeApprovalRequired', () => {
  it('margin below 30 requires finance', () => {
    const r = financeApprovalRequired({ marginPct: '25', minMargin: 30, forecast: '110', budget: '100' });
    expect(r.marginCritical).toBe(true);
    expect(r.forecastWarn).toBe(true);
    expect(r.requireFinance).toBe(true);
  });
});
