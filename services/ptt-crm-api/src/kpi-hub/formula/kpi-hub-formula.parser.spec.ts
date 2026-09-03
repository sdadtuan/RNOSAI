import { parseKpiHubFormula, validateKpiHubFormula } from './kpi-hub-formula.parser';
import { KPI_HUB_ERROR_CODES } from '../kpi-hub.types';

describe('kpi-hub-formula.parser', () => {
  it('parses RATIO with KPI codes', () => {
    const ast = parseKpiHubFormula('RATIO(MKT_004 / MKT_002)');
    expect(ast.kind).toBe('RATIO');
    expect(ast.numerator?.kpi_code).toBe('MKT_004');
    expect(ast.denominator?.kpi_code).toBe('MKT_002');
  });

  it('parses DISTINCTCOUNT Leads', () => {
    const ast = parseKpiHubFormula(
      'DISTINCTCOUNT(Leads[Lead_ID] WHERE Is_Valid = TRUE AND Is_Duplicate = FALSE AND Is_Test = FALSE)',
    );
    expect(ast.kind).toBe('DISTINCT_COUNT');
    expect(ast.entity).toBe('Leads');
    expect(ast.field).toBe('Lead_ID');
    expect(ast.filters.length).toBeGreaterThan(0);
  });

  it('parses SUM AdInsights spend', () => {
    const ast = parseKpiHubFormula('SUM(AdInsights[Spend])');
    expect(ast.kind).toBe('SUM');
    expect(ast.entity).toBe('AdInsights');
    expect(ast.field).toBe('Spend');
  });

  it('validates CPL ratio without cycle', () => {
    const result = validateKpiHubFormula({
      code: 'MKT_006',
      expression: 'RATIO(MKT_004 / MKT_002)',
      numerator_code: 'MKT_004',
      denominator_code: 'MKT_002',
      known_codes: ['MKT_004', 'MKT_002', 'MKT_006'],
    });
    expect(result.valid).toBe(true);
    expect(result.tech_preview).toBe('DIVIDE([MKT_004], [MKT_002])');
  });

  it('detects cycle MKT_003 → MKT_002 → MKT_003', () => {
    const result = validateKpiHubFormula({
      code: 'MKT_003',
      expression: 'RATIO(MKT_002 / MKT_003)',
      numerator_code: 'MKT_002',
      denominator_code: 'MKT_003',
      known_codes: ['MKT_002', 'MKT_003'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(KPI_HUB_ERROR_CODES.FORMULA_CYCLE);
  });

  it('rejects SQL injection', () => {
    expect(() => parseKpiHubFormula('COUNT(Lead); DROP TABLE crm_leads')).toThrow(
      KPI_HUB_ERROR_CODES.FORMULA_INVALID,
    );
  });

  it('rejects unknown entity', () => {
    expect(() => parseKpiHubFormula('SUM(UnknownTable[amount])')).toThrow(
      KPI_HUB_ERROR_CODES.FORMULA_INVALID,
    );
  });
});
