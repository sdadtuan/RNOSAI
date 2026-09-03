import { validateKpiTypeCode, validateKpiTypeTargets, validateKpiTypeWeights } from './kpi-types.validation';

describe('validateKpiTypeCode', () => {
  it('accepts MQL_COUNT', () => {
    expect(validateKpiTypeCode('MQL_COUNT')).toBeNull();
  });
  it('rejects lowercase', () => {
    expect(validateKpiTypeCode('mql')).toBe('KPI_TYPE_CODE_INVALID');
  });
  it('rejects empty', () => {
    expect(validateKpiTypeCode('')).toBe('KPI_TYPE_CODE_REQUIRED');
  });
});

describe('validateKpiTypeTargets', () => {
  it('INCREASE THRESHOLD requires min <= default <= stretch', () => {
    expect(
      validateKpiTypeTargets({
        direction: 'INCREASE',
        target_mode: 'THRESHOLD',
        minimum_target: 900,
        default_target: 1200,
        stretch_target: 1500,
      }),
    ).toBeNull();
    expect(
      validateKpiTypeTargets({
        direction: 'INCREASE',
        target_mode: 'THRESHOLD',
        minimum_target: 1500,
        default_target: 1200,
        stretch_target: 900,
      }),
    ).toBe('KPI_TYPE_TARGET_INVALID');
  });

  it('RANGE requires lower <= default <= upper', () => {
    expect(
      validateKpiTypeTargets({
        direction: 'RANGE',
        target_mode: 'RANGE',
        default_target: 50,
        lower_limit: 40,
        upper_limit: 60,
      }),
    ).toBeNull();
    expect(
      validateKpiTypeTargets({
        direction: 'RANGE',
        target_mode: 'RANGE',
        default_target: 50,
        lower_limit: 70,
        upper_limit: 60,
      }),
    ).toBe('KPI_TYPE_RANGE_INVALID');
  });
});

describe('validateKpiTypeWeights', () => {
  it('accepts min <= max', () => {
    expect(validateKpiTypeWeights(15, 35)).toBeNull();
  });
  it('rejects max < min', () => {
    expect(validateKpiTypeWeights(40, 10)).toBe('KPI_TYPE_WEIGHT_INVALID');
  });
});
