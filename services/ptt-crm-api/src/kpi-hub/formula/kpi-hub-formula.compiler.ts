import type { HubFormulaAst, HubFormulaFilter } from './kpi-hub-formula.parser';
import type { KpiHubQueryPeriod } from '../connectors/kpi-hub-connector.port';

export type CompiledSqlFragment = {
  conditions: string[];
  params: unknown[];
};

const FIELD_COLUMN_MAP: Record<string, Record<string, string>> = {
  Lead: {
    lead_id: 'id',
    Lead_ID: 'id',
    lifecycle_stage: 'status',
    status: 'status',
    source: 'source',
    created_at: 'created_at',
    date: 'created_at',
    Is_Valid: 'is_valid',
    Is_Duplicate: 'is_duplicate',
    Is_Test: 'is_test',
  },
  Leads: {
    lead_id: 'id',
    Lead_ID: 'id',
    lifecycle_stage: 'status',
    status: 'status',
    source: 'source',
    created_at: 'created_at',
    date: 'created_at',
    Is_Valid: 'is_valid',
    Is_Duplicate: 'is_duplicate',
    Is_Test: 'is_test',
  },
  AdInsights: {
    spend: 'spend',
    Spend: 'spend',
    date: 'performance_date',
    campaign_id: 'campaign_id',
  },
  daily_performance: {
    spend: 'spend',
    Spend: 'spend',
    date: 'performance_date',
    campaign_id: 'campaign_id',
  },
};

function resolveColumn(table: string, field: string): string | null {
  if (table === 'crm_leads') {
    return FIELD_COLUMN_MAP.Lead[field] ?? FIELD_COLUMN_MAP.Leads[field] ?? null;
  }
  return FIELD_COLUMN_MAP[table]?.[field] ?? null;
}

export function compileFiltersToSql(
  filters: HubFormulaFilter[],
  period: KpiHubQueryPeriod,
  table: string,
): CompiledSqlFragment {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let idx = 1;

  for (const filter of filters) {
    const col = resolveColumn(table, filter.field);
    if (!col && filter.op !== 'in_period') continue;

    if (filter.op === 'in_period') {
      const dateCol = resolveColumn(table, filter.field) ?? 'created_at';
      conditions.push(`${dateCol} >= $${idx} AND ${dateCol} < $${idx + 1}`);
      params.push(period.from.toISOString(), period.to.toISOString());
      idx += 2;
      continue;
    }

    if (filter.op === 'flag' && col) {
      const boolVal = String(filter.value).toUpperCase() === 'TRUE';
      conditions.push(`${col} = $${idx}`);
      params.push(boolVal);
      idx += 1;
      continue;
    }

    if (filter.op === 'eq' && col) {
      conditions.push(`lower(COALESCE(${col}::text, '')) = lower($${idx})`);
      params.push(filter.value ?? '');
      idx += 1;
    }
  }

  return { conditions, params };
}

export type CompiledRatioQuery = {
  kind: 'RATIO';
  numerator: CompiledAggQuery | { kind: 'KPI_REF'; code: string };
  denominator: CompiledAggQuery | { kind: 'KPI_REF'; code: string };
  blank_if_zero: boolean;
};

export type CompiledAggQuery = {
  kind: 'AGG';
  entity: string;
  agg: string;
  field?: string;
  table: string;
  where: CompiledSqlFragment;
};

function entityTable(entity: string): string {
  if (entity === 'Lead' || entity === 'Leads') return 'crm_leads';
  if (entity === 'AdInsights' || entity === 'AdSpend') return 'daily_performance';
  if (entity === 'Contracts') return 'crm_leads';
  return 'crm_leads';
}

export function compileAggQuery(ast: HubFormulaAst, period: KpiHubQueryPeriod): CompiledAggQuery | null {
  if (ast.kind === 'RATIO' && ast.kpi_code) return null;
  if (!ast.entity) return null;

  const table = entityTable(ast.entity);
  const where = compileFiltersToSql(ast.filters, period, table);
  return {
    kind: 'AGG',
    entity: ast.entity,
    agg: ast.kind,
    field: ast.field,
    table,
    where,
  };
}

export function compileFormula(ast: HubFormulaAst, period: KpiHubQueryPeriod): CompiledRatioQuery | CompiledAggQuery {
  if (ast.kind === 'RATIO') {
    if (ast.numerator && ast.denominator) {
      const num = ast.numerator.kpi_code
        ? { kind: 'KPI_REF' as const, code: ast.numerator.kpi_code }
        : compileAggQuery(ast.numerator, period);
      const den = ast.denominator.kpi_code
        ? { kind: 'KPI_REF' as const, code: ast.denominator.kpi_code }
        : compileAggQuery(ast.denominator, period);
      if (num && den) {
        return {
          kind: 'RATIO',
          numerator: num,
          denominator: den,
          blank_if_zero: ast.blank_if_zero ?? true,
        };
      }
    }
    if (ast.kpi_code) {
      return {
        kind: 'RATIO',
        numerator: { kind: 'KPI_REF', code: ast.kpi_code },
        denominator: { kind: 'KPI_REF', code: ast.kpi_code },
        blank_if_zero: ast.blank_if_zero ?? true,
      };
    }
  }
  const agg = compileAggQuery(ast, period);
  if (!agg) throw new Error('COMPILE_FAILED');
  return agg;
}

export function whereClause(fragment: CompiledSqlFragment): string {
  return fragment.conditions.join(' AND ');
}
