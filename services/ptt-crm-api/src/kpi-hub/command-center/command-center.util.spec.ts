import {
  applyDataIssuePrecedence,
  classifyDealRisk,
  deltaPct,
  pickBottleneck,
  ruleBasedInsight,
  tileCodesFor,
  weightedPipeline,
} from './command-center.util';

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

describe('pickBottleneck', () => {
  it('picks stage whose conversion misses target, not merely lowest volume', () => {
    const hit = pickBottleneck([
      { code: 'MKT_002', name: 'Valid', conversion: 0.8, targetConversion: 0.7 },
      { code: 'MKT_008', name: 'MQL Rate', conversion: 0.2, targetConversion: 0.35, kpiStatus: 'CRITICAL' },
    ]);
    expect(hit.code).toBe('MKT_008');
    expect(hit.label).toMatch(/MQL/);
  });
});

describe('weightedPipeline', () => {
  it('returns unweighted when probability missing', () => {
    expect(weightedPipeline(100, null)).toEqual({ value: 100, weighted: false });
    expect(weightedPipeline(100, 0.5)).toEqual({ value: 50, weighted: true });
  });
});

describe('classifyDealRisk', () => {
  it('flags rule-based risks', () => {
    const flags = classifyDealRisk({
      lastActivityAt: '2026-08-01',
      closeDate: '2026-09-01',
      todayIso: '2026-09-04',
      hasQuote: false,
      hasNextStep: false,
      stageAgeDays: 40,
      noActivityDaysThreshold: 14,
    });
    expect(flags).toEqual(expect.arrayContaining([
      'no_activity', 'overdue_close', 'missing_quote', 'missing_next_step', 'stage_aging',
    ]));
  });
});

describe('ruleBasedInsight', () => {
  it('hides when fewer than two deltas', () => {
    expect(ruleBasedInsight({ spendDeltaPct: null, validDeltaPct: 10 })).toBeNull();
    expect(ruleBasedInsight({ spendDeltaPct: 5, validDeltaPct: -10 })).toMatch(/Valid/);
  });
});
