import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KPI_GROUP_FORM,
  isKpiGroupFormValid,
  normalizeKpiGroupCode,
  validateKpiGroupCode,
  validateKpiGroupForm,
  validateKpiGroupScope,
} from './kpi-group-form.util';

describe('validateKpiGroupCode', () => {
  it('accepts GROWTH_CONVERSION', () => {
    expect(validateKpiGroupCode('GROWTH_CONVERSION')).toBeNull();
  });

  it('rejects lowercase', () => {
    expect(validateKpiGroupCode('growth')).toBe('KPI_GROUP_CODE_INVALID');
  });

  it('requires code', () => {
    expect(validateKpiGroupCode('')).toBe('KPI_GROUP_CODE_REQUIRED');
  });
});

describe('normalizeKpiGroupCode', () => {
  it('uppercases and replaces spaces', () => {
    expect(normalizeKpiGroupCode('growth conversion')).toBe('GROWTH_CONVERSION');
  });
});

describe('validateKpiGroupScope', () => {
  it('allows organization without departments', () => {
    expect(validateKpiGroupScope({ scope_type: 'ORGANIZATION' })).toBeNull();
  });

  it('requires departments for department scope', () => {
    expect(validateKpiGroupScope({ scope_type: 'DEPARTMENT', department_ids: [] })).toBe(
      'KPI_GROUP_SCOPE_REQUIRED',
    );
  });

  it('requires positions for position scope', () => {
    expect(
      validateKpiGroupScope({ scope_type: 'POSITION', department_ids: ['d1'], position_ids: [] }),
    ).toBe('KPI_GROUP_SCOPE_REQUIRED');
  });
});

describe('validateKpiGroupForm', () => {
  it('returns no errors for valid form', () => {
    const values = {
      ...DEFAULT_KPI_GROUP_FORM,
      code: 'GROWTH_CONVERSION',
      name: 'Tăng trưởng & Chuyển đổi',
      default_direction: 'INCREASE' as const,
      display_order: 1,
    };
    expect(validateKpiGroupForm(values)).toEqual({});
    expect(isKpiGroupFormValid(values)).toBe(true);
  });

  it('flags missing name and direction', () => {
    const errors = validateKpiGroupForm({
      ...DEFAULT_KPI_GROUP_FORM,
      code: 'ABC',
      name: '',
      default_direction: '',
    });
    expect(errors.name).toBe('KPI_GROUP_NAME_REQUIRED');
    expect(errors.default_direction).toBe('KPI_GROUP_DIRECTION_REQUIRED');
  });
});
