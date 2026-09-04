import { compileFiltersToSql, compileFormula } from './kpi-hub-formula.compiler';
import { parseKpiHubFormula } from './kpi-hub-formula.parser';

describe('kpi-hub-formula.compiler', () => {
  const period = {
    from: new Date('2026-09-01T00:00:00Z'),
    to: new Date('2026-10-01T00:00:00Z'),
  };

  it('compiles Is_Valid=TRUE flag filter', () => {
    const ast = parseKpiHubFormula(
      'DISTINCTCOUNT(Leads[Lead_ID] WHERE Is_Valid = TRUE AND Is_Duplicate = FALSE)',
    );
    const compiled = compileFiltersToSql(ast.filters, period, 'crm_leads');
    expect(compiled.conditions).toContain('is_valid = $1');
    expect(compiled.params[0]).toBe(true);
  });

  it('compiles status eq filter', () => {
    const ast = parseKpiHubFormula("DISTINCTCOUNT(Leads[Lead_ID] WHERE status = 'MQL')");
    const compiled = compileFiltersToSql(ast.filters, period, 'crm_leads');
    expect(compiled.conditions.some((c) => c.includes('status'))).toBe(true);
    expect(compiled.params).toContain('MQL');
  });

  it('compiles in_period filter with date bounds', () => {
    const filters = [{ field: 'created_at', op: 'in_period' as const }];
    const compiled = compileFiltersToSql(filters, period, 'crm_leads');
    expect(compiled.conditions.some((c) => c.includes('created_at >='))).toBe(true);
    expect(compiled.params).toHaveLength(2);
  });

  it('compiles RATIO formula with KPI refs', () => {
    const ast = parseKpiHubFormula('RATIO(MKT_007 / MKT_002)');
    const compiled = compileFormula(ast, period);
    expect(compiled.kind).toBe('RATIO');
    if (compiled.kind === 'RATIO') {
      expect(compiled.numerator).toEqual({ kind: 'KPI_REF', code: 'MKT_007' });
      expect(compiled.denominator).toEqual({ kind: 'KPI_REF', code: 'MKT_002' });
    }
  });

  it('compiles SUM AdInsights spend agg', () => {
    const ast = parseKpiHubFormula('SUM(AdInsights[Spend])');
    const compiled = compileFormula(ast, period);
    expect(compiled.kind).toBe('AGG');
    if (compiled.kind === 'AGG') {
      expect(compiled.entity).toBe('AdInsights');
      expect(compiled.agg).toBe('SUM');
      expect(compiled.field).toBe('Spend');
      expect(compiled.table).toBe('daily_performance');
    }
  });
});
