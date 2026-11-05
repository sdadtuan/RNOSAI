import {
  isMaterialReconcileVariance,
  variancePctAgainstQuoted,
} from './service-kpi-change-order';

describe('service-kpi-change-order', () => {
  it('flags material variance when delivered exceeds quoted target by 15%+', () => {
    expect(
      isMaterialReconcileVariance({
        instance_id: '1',
        dictionary_id: 'dict-cpl',
        quoted: { target_max: 100000 },
        delivered: 128000,
        quality_status: 'valid',
        behavior: 'OK',
      }),
    ).toBe(true);
    expect(variancePctAgainstQuoted({ target_max: 100000 }, 128000)).toBe(28);
  });

  it('flags blocked reported rows as material', () => {
    expect(
      isMaterialReconcileVariance({
        instance_id: '1',
        dictionary_id: 'dict-cpl',
        quoted: { target_max: 100000 },
        delivered: 95000,
        quality_status: 'pending_validation',
        behavior: 'Chặn Reported',
      }),
    ).toBe(true);
  });

  it('does not flag on-track variance under threshold', () => {
    expect(
      isMaterialReconcileVariance({
        instance_id: '1',
        dictionary_id: 'dict-cpl',
        quoted: { target_max: 100000 },
        delivered: 105000,
        quality_status: 'valid',
        behavior: 'OK',
      }),
    ).toBe(false);
  });
});
