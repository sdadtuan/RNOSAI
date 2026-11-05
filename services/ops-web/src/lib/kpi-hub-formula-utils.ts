import type { KpiHubFormulaFilter } from './kpi-hub-types';

export const FORMULA_FILTER_FIELDS = [
  'Status',
  'Campaign',
  'Channel',
  'Team',
  'Product',
  'Date',
  'Currency',
] as const;

export const FORMULA_FILTER_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'CONTAINS'] as const;

export function createFormulaFilter(partial: Partial<KpiHubFormulaFilter> = {}): KpiHubFormulaFilter {
  return {
    id: partial.id ?? `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    field: partial.field ?? FORMULA_FILTER_FIELDS[0],
    operator: partial.operator ?? '=',
    value: partial.value ?? '',
    join: partial.join,
  };
}

export function filtersToDisplay(filters: KpiHubFormulaFilter[]): string {
  if (!filters.length) return '';
  return filters
    .map((f, i) => {
      const clause = `${f.field} ${f.operator} ${f.value}`.trim();
      if (i === 0) return clause;
      return ` ${f.join ?? 'AND'} ${clause}`;
    })
    .join('');
}

export function toggleFilterJoin(filters: KpiHubFormulaFilter[], id: string): KpiHubFormulaFilter[] {
  return filters.map((f) =>
    f.id === id ? { ...f, join: f.join === 'OR' ? 'AND' : 'OR' } : f,
  );
}

export function updateFilter(
  filters: KpiHubFormulaFilter[],
  id: string,
  patch: Partial<KpiHubFormulaFilter>,
): KpiHubFormulaFilter[] {
  return filters.map((f) => (f.id === id ? { ...f, ...patch } : f));
}

export function removeFilter(filters: KpiHubFormulaFilter[], id: string): KpiHubFormulaFilter[] {
  return filters.filter((f) => f.id !== id);
}
