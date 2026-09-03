import {
  KPI_GROUP_CODE_RE,
  isValidStatusTransition,
  validateCreateKpiGroupBody,
  validateKpiGroupCode,
  validateKpiGroupColor,
  validateKpiGroupDisplayOrder,
  validateKpiGroupScope,
  validatePatchKpiGroupBody,
} from './kpi-groups.validation';
import { KPI_GROUP_ERROR_CODES } from './kpi-groups.types';

describe('validateKpiGroupCode', () => {
  it('accepts GROWTH_CONVERSION', () => {
    expect(validateKpiGroupCode('GROWTH_CONVERSION')).toBeNull();
  });

  it('rejects lowercase', () => {
    expect(validateKpiGroupCode('growth')).toBe(KPI_GROUP_ERROR_CODES.CODE_INVALID);
  });

  it('rejects empty', () => {
    expect(validateKpiGroupCode('')).toBe(KPI_GROUP_ERROR_CODES.CODE_REQUIRED);
  });

  it('rejects too short', () => {
    expect(validateKpiGroupCode('AB')).toBe(KPI_GROUP_ERROR_CODES.CODE_INVALID);
  });
});

describe('KPI_GROUP_CODE_RE', () => {
  it('matches valid codes', () => {
    expect(KPI_GROUP_CODE_RE.test('BUDGET_EFFICIENCY')).toBe(true);
  });
});

describe('validateKpiGroupColor', () => {
  it('accepts hex color', () => {
    expect(validateKpiGroupColor('#17B6A4')).toBe(true);
  });

  it('rejects invalid color', () => {
    expect(validateKpiGroupColor('red')).toBe(false);
  });
});

describe('validateKpiGroupScope', () => {
  it('allows ORGANIZATION without departments', () => {
    expect(
      validateKpiGroupScope({ scope_type: 'ORGANIZATION', department_ids: [] }),
    ).toBeNull();
  });

  it('requires departments for DEPARTMENT scope', () => {
    expect(
      validateKpiGroupScope({ scope_type: 'DEPARTMENT', department_ids: [] }),
    ).toBe(KPI_GROUP_ERROR_CODES.SCOPE_REQUIRED);
  });

  it('requires dept or position for POSITION scope', () => {
    expect(
      validateKpiGroupScope({ scope_type: 'POSITION', department_ids: [], position_ids: [] }),
    ).toBe(KPI_GROUP_ERROR_CODES.SCOPE_REQUIRED);
  });

  it('accepts POSITION with position_ids', () => {
    expect(
      validateKpiGroupScope({ scope_type: 'POSITION', position_ids: [1] }),
    ).toBeNull();
  });
});

describe('validateKpiGroupDisplayOrder', () => {
  it('rejects zero', () => {
    expect(validateCreateKpiGroupBody({
      code: 'TEST_GROUP',
      name: 'Test Group',
      scope_type: 'ORGANIZATION',
      default_direction: 'INCREASE',
      display_order: 0,
    })).toBe(KPI_GROUP_ERROR_CODES.ORDER_INVALID);
  });
});

describe('validateCreateKpiGroupBody', () => {
  it('passes valid body', () => {
    expect(
      validateCreateKpiGroupBody({
        code: 'GROWTH_CONVERSION',
        name: 'Tăng trưởng & Chuyển đổi',
        scope_type: 'ORGANIZATION',
        default_direction: 'INCREASE',
      }),
    ).toBeNull();
  });
});

describe('validatePatchKpiGroupBody', () => {
  it('validates partial code', () => {
    expect(validatePatchKpiGroupBody({ code: 'bad' })).toBe(
      KPI_GROUP_ERROR_CODES.CODE_INVALID,
    );
  });
});

describe('isValidStatusTransition', () => {
  it('allows DRAFT to ACTIVE', () => {
    expect(isValidStatusTransition('DRAFT', 'ACTIVE')).toBe(true);
  });

  it('blocks DRAFT to INACTIVE', () => {
    expect(isValidStatusTransition('DRAFT', 'INACTIVE')).toBe(false);
  });
});
