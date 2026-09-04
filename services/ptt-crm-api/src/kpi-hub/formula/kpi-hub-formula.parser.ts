import { createHash } from 'crypto';
import { KPI_HUB_ERROR_CODES } from '../kpi-hub.types';
import { hasFormulaCycle } from '../kpi-hub-status';

export type HubFormulaAggregation =
  | 'COUNT'
  | 'SUM'
  | 'AVG'
  | 'DISTINCTCOUNT'
  | 'DISTINCT_COUNT'
  | 'RATE'
  | 'RATIO'
  | 'COMPOSITE';

export type HubSourceBinding = {
  entity_name: string;
  agg: string;
  value_field?: string;
  filters: HubFormulaFilter[];
};

export type HubFormulaFilter = {
  field: string;
  op: 'eq' | 'in_period' | 'flag';
  value?: string;
};

export type HubFormulaAst = {
  kind: HubFormulaAggregation;
  entity?: string;
  field?: string;
  kpi_code?: string;
  expression?: string;
  refs?: string[];
  filters: HubFormulaFilter[];
  numerator?: HubFormulaAst;
  denominator?: HubFormulaAst;
  blank_if_zero?: boolean;
  non_additive?: boolean;
};

const COMPOSITE_ALLOW = /^[\d\s+\-*/().\[\]A-Z_0-9]+$/;
const COMPOSITE_REF = /\[([A-Z]{2,5}_[A-Z0-9_]+)\]/g;

const FORBIDDEN = /;|--|\/\*|\b(DROP|DELETE|INSERT|UPDATE|ALTER|UNION|EXEC|TRUNCATE)\b/i;
const KPI_CODE = /^[A-Z]{2,5}_[A-Z0-9_]+$/;
const ALLOWED_ENTITIES = new Set(['Lead', 'Leads', 'AdInsights', 'Deals', 'Contracts', 'Invoices', 'Payments']);
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  Lead: new Set(['lead_id', 'Lead_ID', 'lifecycle_stage', 'created_at', 'source', 'status', 'Is_Valid', 'Is_Duplicate', 'Is_Test']),
  Leads: new Set(['lead_id', 'Lead_ID', 'lifecycle_stage', 'created_at', 'source', 'status', 'Is_Valid', 'Is_Duplicate', 'Is_Test']),
  AdInsights: new Set(['spend', 'Spend', 'date', 'campaign_id']),
  Deals: new Set(['Amount', 'amount', 'deal_id', 'Deal_ID']),
  Contracts: new Set(['Value', 'value']),
  Invoices: new Set(['Amount', 'amount']),
  Payments: new Set(['Amount', 'amount']),
};

function fail(code: string = KPI_HUB_ERROR_CODES.FORMULA_INVALID): never {
  throw new Error(code);
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

function parseFilters(raw: string, entity: string): HubFormulaFilter[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+AND\s+/i);
  const allowed = ALLOWED_FIELDS[entity] ?? new Set<string>();
  return parts.map((part) => {
    const token = part.trim();
    const flag = token.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(TRUE|FALSE)$/i);
    if (flag) {
      const field = flag[1];
      if (!allowed.has(field)) fail();
      return { field, op: 'flag' as const, value: flag[2].toUpperCase() };
    }
    const inPeriod = token.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+IN\s+evaluation_period$/i);
    if (inPeriod) {
      const field = inPeriod[1];
      if (!allowed.has(field)) fail();
      return { field, op: 'in_period' as const };
    }
    const eq = token.match(/^([A-Za-z_][A-Za-z0-9_]*)?\s*=\s*'([^']*)'$/);
    if (eq) {
      const field = eq[1];
      if (!field || !allowed.has(field)) fail();
      return { field, op: 'eq' as const, value: eq[2] };
    }
    const statusEq = token.match(/^status\s*=\s*'([^']*)'$/i);
    if (statusEq) {
      return { field: 'status', op: 'eq' as const, value: statusEq[1] };
    }
    fail();
  });
}

function parseAggExpr(expr: string): HubFormulaAst {
  const trimmed = expr.trim();
  if (KPI_CODE.test(trimmed)) {
    return { kind: 'RATIO', kpi_code: trimmed, filters: [] };
  }

  const m = trimmed.match(
    /^(COUNT|SUM|AVG|DISTINCTCOUNT|DISTINCT_COUNT)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)(?:\[([A-Za-z_][A-Za-z0-9_]*)\])?(?:\s+WHERE\s+([\s\S]+))?\s*\)$/i,
  );
  if (!m) fail();

  const kind = m[1].toUpperCase().replace('DISTINCTCOUNT', 'DISTINCT_COUNT') as HubFormulaAggregation;
  const entity = m[2];
  if (!ALLOWED_ENTITIES.has(entity)) fail();
  const field = m[3] || undefined;
  if (field && !(ALLOWED_FIELDS[entity]?.has(field))) fail();
  if ((kind === 'SUM' || kind === 'AVG') && !field) fail();

  return {
    kind,
    entity,
    field,
    filters: parseFilters(m[4] ?? '', entity),
  };
}

function parseCompositeExpression(trimmed: string): HubFormulaAst {
  if (!COMPOSITE_ALLOW.test(trimmed)) fail();
  const refs = [...trimmed.matchAll(COMPOSITE_REF)].map((m) => m[1]);
  for (const ref of refs) {
    if (!KPI_CODE.test(ref)) fail();
  }
  return { kind: 'COMPOSITE', expression: trimmed, refs, filters: [] };
}

export function parseKpiHubFormula(expr: string): HubFormulaAst {
  const trimmed = String(expr ?? '').trim();
  if (!trimmed) fail();
  if (FORBIDDEN.test(trimmed)) fail();

  if (/^COMPOSITE\s*\(/i.test(trimmed)) {
    const inner = trimmed.match(/^COMPOSITE\s*\(([\s\S]+)\)$/i);
    if (!inner?.[1]) fail();
    return parseCompositeExpression(inner[1].trim());
  }

  if (/\[[A-Z]{2,5}_[A-Z0-9_]+\]/.test(trimmed) && !/^(COUNT|SUM|AVG|DISTINCT)/i.test(trimmed)) {
    return parseCompositeExpression(trimmed);
  }

  const ratioMatch = trimmed.match(/^RATIO\s*\(([\s\S]+)\)$/i);
  if (ratioMatch) {
    const parts = splitTopLevel(ratioMatch[1], '/').map((p) => p.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) fail();
    return {
      kind: 'RATIO',
      filters: [],
      numerator: parseKpiHubFormula(parts[0]),
      denominator: parseKpiHubFormula(parts[1]),
    };
  }

  const divideMatch = trimmed.match(/^DIVIDE\s*\(\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*\)$/i);
  if (divideMatch) {
    return {
      kind: 'RATIO',
      filters: [],
      numerator: { kind: 'RATIO', kpi_code: divideMatch[1].trim(), filters: [] },
      denominator: { kind: 'RATIO', kpi_code: divideMatch[2].trim(), filters: [] },
    };
  }

  if (KPI_CODE.test(trimmed)) {
    return { kind: 'RATIO', kpi_code: trimmed, filters: [] };
  }

  return parseAggExpr(trimmed);
}

export function buildFormulaEdges(
  code: string,
  ast: HubFormulaAst,
  knownCodes: Set<string>,
): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  const visit = (from: string, node: HubFormulaAst) => {
    if (node.kpi_code && knownCodes.has(node.kpi_code)) {
      edges.push({ from, to: node.kpi_code });
    }
    if (node.refs) {
      for (const ref of node.refs) {
        if (knownCodes.has(ref)) edges.push({ from, to: ref });
      }
    }
    if (node.numerator) visit(from, node.numerator);
    if (node.denominator) visit(from, node.denominator);
  };
  visit(code, ast);
  return edges;
}

export function validateKpiHubFormula(input: {
  code: string;
  expression: string;
  numerator_code?: string | null;
  denominator_code?: string | null;
  known_codes?: string[];
}): { valid: boolean; ast?: HubFormulaAst; tech_preview?: string; errors?: string[] } {
  const errors: string[] = [];
  const known = new Set(input.known_codes ?? []);
  known.add(input.code);

  try {
    let ast: HubFormulaAst;
    if (input.numerator_code && input.denominator_code) {
      ast = {
        kind: 'RATIO',
        filters: [],
        numerator: { kind: 'RATIO', kpi_code: input.numerator_code, filters: [] },
        denominator: { kind: 'RATIO', kpi_code: input.denominator_code, filters: [] },
        blank_if_zero: true,
        non_additive: true,
      };
    } else {
      ast = parseKpiHubFormula(input.expression);
    }

    const edges: Array<{ from: string; to: string }> = [];
    if (input.numerator_code) edges.push({ from: input.code, to: input.numerator_code });
    if (input.denominator_code) edges.push({ from: input.code, to: input.denominator_code });
    edges.push(...buildFormulaEdges(input.code, ast, known));

    if (hasFormulaCycle(edges)) {
      errors.push(KPI_HUB_ERROR_CODES.FORMULA_CYCLE);
      return { valid: false, errors };
    }

    const tech_preview =
      input.numerator_code && input.denominator_code
        ? `DIVIDE([${input.numerator_code}], [${input.denominator_code}])`
        : ast.kind === 'RATIO' && ast.numerator?.kpi_code && ast.denominator?.kpi_code
          ? `DIVIDE([${ast.numerator.kpi_code}], [${ast.denominator.kpi_code}])`
          : input.expression;

    return { valid: true, ast, tech_preview };
  } catch (e) {
    errors.push(String((e as Error).message ?? KPI_HUB_ERROR_CODES.FORMULA_INVALID));
    return { valid: false, errors };
  }
}

export function toDaxPreview(numeratorCode?: string | null, denominatorCode?: string | null): string {
  if (!numeratorCode || !denominatorCode) return '';
  return `DIVIDE([${numeratorCode}], [${denominatorCode}])`;
}

function normalizeAstForChecksum(ast: HubFormulaAst): Record<string, unknown> {
  return {
    kind: ast.kind,
    entity: ast.entity ?? null,
    field: ast.field ?? null,
    kpi_code: ast.kpi_code ?? null,
    expression: ast.expression ?? null,
    refs: ast.refs ?? [],
    filters: ast.filters,
    numerator: ast.numerator ? normalizeAstForChecksum(ast.numerator) : null,
    denominator: ast.denominator ? normalizeAstForChecksum(ast.denominator) : null,
  };
}

export function formulaAstChecksum(ast: HubFormulaAst): string {
  const payload = JSON.stringify(normalizeAstForChecksum(ast));
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function bindingsChecksum(bindings: HubSourceBinding[]): string {
  const normalized = bindings.map((b) => ({
    entity_name: b.entity_name,
    agg: b.agg,
    value_field: b.value_field ?? null,
    filters: b.filters,
  }));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}

export function astToBindings(ast: HubFormulaAst): HubSourceBinding[] {
  if (ast.kind === 'RATIO' && ast.numerator && ast.denominator) {
    return [...astToBindings(ast.numerator), ...astToBindings(ast.denominator)];
  }
  if (ast.kind === 'COMPOSITE') return [];
  if (ast.entity) {
    return [
      {
        entity_name: ast.entity,
        agg: ast.kind === 'DISTINCT_COUNT' ? 'DISTINCTCOUNT' : ast.kind,
        value_field: ast.field,
        filters: ast.filters,
      },
    ];
  }
  return [];
}

export function checksumsMatch(ast: HubFormulaAst, bindings: HubSourceBinding[]): boolean {
  if (ast.kind === 'COMPOSITE' || ast.kind === 'RATIO') return true;
  const derived = astToBindings(ast);
  if (!derived.length && !bindings.length) return true;
  return formulaAstChecksum(ast) === bindingsChecksum(bindings.length ? bindings : derived);
}

/** Estimate matching row count for formula preview (fixture-based v1). */
export function estimatePreviewRowCount(ast: HubFormulaAst): number {
  if (ast.kind === 'COMPOSITE') return 0;
  if (ast.kind === 'RATIO') {
    const num = ast.numerator ? estimatePreviewRowCount(ast.numerator) : 1486;
    const den = ast.denominator ? estimatePreviewRowCount(ast.denominator) : 2340;
    return Math.min(num, den);
  }
  const entity = (ast.entity ?? '').toLowerCase();
  if (entity.includes('lead')) return 1486;
  if (entity.includes('adinsight')) return 31;
  if (entity.includes('deal')) return 420;
  if (entity.includes('invoice') || entity.includes('payment')) return 180;
  return 100;
}
