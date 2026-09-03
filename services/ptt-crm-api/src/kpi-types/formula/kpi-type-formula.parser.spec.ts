import { parseKpiTypeFormula } from './kpi-type-formula.parser';

describe('parseKpiTypeFormula', () => {
  it('parses MQL count', () => {
    const ast = parseKpiTypeFormula(
      "COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)",
    );
    expect(ast.aggregation).toBe('COUNT');
    expect(ast.entity).toBe('Lead');
    expect(ast.filters).toEqual([
      { field: 'lifecycle_stage', op: 'eq', value: 'MQL' },
      { field: 'created_at', op: 'in_period' },
    ]);
  });

  it('parses SUM AdSpend', () => {
    const ast = parseKpiTypeFormula('SUM(AdSpend.amount WHERE date IN evaluation_period)');
    expect(ast.aggregation).toBe('SUM');
    expect(ast.entity).toBe('AdSpend');
    expect(ast.field).toBe('amount');
  });

  it('parses RATE of two aggregations', () => {
    const ast = parseKpiTypeFormula(
      "RATE(SUM(AdSpend.amount WHERE date IN evaluation_period) / COUNT(Lead WHERE source_category = 'Paid' AND created_at IN evaluation_period))",
    );
    expect(ast.aggregation).toBe('RATE');
    expect(ast.rate?.numerator.aggregation).toBe('SUM');
    expect(ast.rate?.denominator.aggregation).toBe('COUNT');
  });

  it('rejects SQL injection', () => {
    expect(() => parseKpiTypeFormula('COUNT(Lead); DROP TABLE crm_leads')).toThrow(
      'KPI_TYPE_FORMULA_INVALID',
    );
  });

  it('rejects unknown field', () => {
    expect(() => parseKpiTypeFormula("COUNT(Lead WHERE email = 'a@b.com')")).toThrow(
      'KPI_TYPE_FORMULA_INVALID',
    );
  });
});
