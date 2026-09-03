import { KPI_TYPE_ERROR_CODES } from '../kpi-types.types';

export type KpiFormulaAggregation = 'COUNT' | 'SUM' | 'AVG' | 'RATE' | 'DISTINCT_COUNT';

export type KpiFormulaFilter = {
  field: string;
  op: 'eq' | 'in_period';
  value?: string;
};

export type KpiFormulaAst = {
  aggregation: KpiFormulaAggregation;
  entity: string;
  field?: string;
  filters: KpiFormulaFilter[];
  rate?: { numerator: KpiFormulaAst; denominator: KpiFormulaAst };
};

const FORBIDDEN = /;|--|\/\*|\b(DROP|DELETE|INSERT|UPDATE|ALTER|UNION|EXEC|TRUNCATE)\b/i;
const ALLOWED_ENTITIES = new Set(['Lead', 'AdSpend', 'AttributedRevenue']);
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  Lead: new Set(['lifecycle_stage', 'created_at', 'source', 'source_category', 'status']),
  AdSpend: new Set(['amount', 'date']),
  AttributedRevenue: new Set(['amount', 'date']),
};

function fail(): never {
  throw new Error(KPI_TYPE_ERROR_CODES.FORMULA_INVALID);
}

function splitTopLevel(expr: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === sep && depth === 0) {
      parts.push(expr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts;
}

function parseFilters(raw: string, entity: string): KpiFormulaFilter[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+AND\s+/i);
  const allowed = ALLOWED_FIELDS[entity] ?? new Set<string>();
  return parts.map((part) => {
    const token = part.trim();
    const inPeriod = token.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+IN\s+evaluation_period$/i);
    if (inPeriod) {
      const field = inPeriod[1];
      if (!allowed.has(field)) fail();
      return { field, op: 'in_period' as const };
    }
    const eq = token.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']*)'$/);
    if (eq) {
      const field = eq[1];
      if (!allowed.has(field)) fail();
      return { field, op: 'eq' as const, value: eq[2] };
    }
    fail();
  });
}

export function parseKpiTypeFormula(expr: string): KpiFormulaAst {
  const trimmed = String(expr ?? '').trim();
  if (!trimmed) fail();
  if (FORBIDDEN.test(trimmed)) fail();

  const rateMatch = trimmed.match(/^RATE\s*\(([\s\S]+)\)$/i);
  if (rateMatch) {
    const parts = splitTopLevel(rateMatch[1], '/').map((p) => p.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) fail();
    return {
      aggregation: 'RATE',
      entity: 'Rate',
      filters: [],
      rate: {
        numerator: parseKpiTypeFormula(parts[0]),
        denominator: parseKpiTypeFormula(parts[1]),
      },
    };
  }

  const m = trimmed.match(
    /^(COUNT|SUM|AVG|DISTINCT_COUNT)\s*\(\s*(Lead|AdSpend|AttributedRevenue)(?:\.([A-Za-z_][A-Za-z0-9_]*))?(?:\s+WHERE\s+([\s\S]+))?\s*\)$/i,
  );
  if (!m) fail();

  const aggregation = m[1].toUpperCase() as KpiFormulaAggregation;
  const entity = m[2] === 'AdSpend' ? 'AdSpend' : m[2] === 'AttributedRevenue' ? 'AttributedRevenue' : 'Lead';
  if (!ALLOWED_ENTITIES.has(entity)) fail();
  const field = m[3] || undefined;
  if (field && !(ALLOWED_FIELDS[entity]?.has(field))) fail();
  if ((aggregation === 'SUM' || aggregation === 'AVG') && !field) fail();
  if ((aggregation === 'COUNT' || aggregation === 'DISTINCT_COUNT') && entity !== 'Lead' && entity !== 'AdSpend') {
    fail();
  }

  return {
    aggregation,
    entity,
    field,
    filters: parseFilters(m[4] ?? '', entity),
  };
}
