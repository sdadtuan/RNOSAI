import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KPI_TYPE_FORM,
  validateKpiTypeCode,
  validateKpiTypeForm,
  validateKpiTypeTargets,
  validateKpiTypeWeights,
} from './kpi-type-form.util';

describe('validateKpiTypeCode', () => {
  it('accepts MQL_COUNT', () => {
    expect(validateKpiTypeCode('MQL_COUNT')).toBeNull();
  });
  it('rejects lowercase', () => {
    expect(validateKpiTypeCode('mql')).toBe('KPI_TYPE_CODE_INVALID');
  });
});

describe('validateKpiTypeTargets', () => {
  it('INCREASE THRESHOLD min <= default <= stretch', () => {
    expect(
      validateKpiTypeTargets({
        ...DEFAULT_KPI_TYPE_FORM,
        direction: 'INCREASE',
        target_mode: 'THRESHOLD',
        minimum_target: '900',
        default_target: '1200',
        stretch_target: '1500',
      }),
    ).toBeNull();
    expect(
      validateKpiTypeTargets({
        ...DEFAULT_KPI_TYPE_FORM,
        direction: 'INCREASE',
        target_mode: 'THRESHOLD',
        minimum_target: '1500',
        default_target: '1200',
        stretch_target: '900',
      }),
    ).toBe('KPI_TYPE_TARGET_INVALID');
  });
});

describe('validateKpiTypeWeights', () => {
  it('rejects max < min', () => {
    expect(validateKpiTypeWeights('40', '10')).toBe('KPI_TYPE_WEIGHT_INVALID');
  });
});

describe('validateKpiTypeForm', () => {
  it('requires group and AUTO source', () => {
    const errors = validateKpiTypeForm({
      ...DEFAULT_KPI_TYPE_FORM,
      calculation_mode: 'AUTO',
      code: 'MQL_COUNT',
      name: 'Marketing Qualified Leads',
      default_target: '10',
    });
    expect(errors.kpi_group_id).toBe('KPI_TYPE_GROUP_REQUIRED');
    expect(errors.primary_data_source_id).toBe('KPI_TYPE_AUTO_SOURCE_REQUIRED');
  });
});
