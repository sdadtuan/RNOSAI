import { buildFormulaEdges, parseKpiHubFormula, type HubFormulaAst } from './kpi-hub-formula.parser';

export type HubDictionaryEdge = { from: string; to: string };

export type HubDictionaryRef = {
  code: string;
  status: string;
  formula_display?: string | null;
  numerator_code?: string | null;
  denominator_code?: string | null;
};

export type HubDependencyGraph = {
  code: string;
  upstream: string[];
  downstream: string[];
  edges: HubDictionaryEdge[];
};

/** Build dependency edges for all dictionary KPIs. */
export function buildDictionaryEdges(rows: HubDictionaryRef[]): HubDictionaryEdge[] {
  const known = new Set(rows.map((r) => r.code));
  const edges: HubDictionaryEdge[] = [];

  for (const row of rows) {
    if (row.numerator_code && known.has(row.numerator_code)) {
      edges.push({ from: row.code, to: row.numerator_code });
    }
    if (row.denominator_code && known.has(row.denominator_code)) {
      edges.push({ from: row.code, to: row.denominator_code });
    }
    const expr = row.formula_display?.trim();
    if (expr) {
      try {
        const ast = parseKpiHubFormula(expr);
        edges.push(...buildFormulaEdges(row.code, ast, known));
      } catch {
        // skip invalid expressions when building graph
      }
    }
  }

  return dedupeEdges(edges);
}

/** Upstream = KPIs this code depends on; downstream = KPIs that depend on this code. */
export function getUpstreamDownstream(code: string, edges: HubDictionaryEdge[]): HubDependencyGraph {
  const upstream = [...new Set(edges.filter((e) => e.from === code).map((e) => e.to))];
  const downstream = [...new Set(edges.filter((e) => e.to === code).map((e) => e.from))];
  return { code, upstream, downstream, edges: edges.filter((e) => e.from === code || e.to === code) };
}

/**
 * When an upstream KPI is unpublished or materially changed, mark downstream ACTIVE rows NEED_REVIEW.
 */
export function markNeedReviewOnUpstreamChange(
  upstreamCode: string,
  rows: Array<{ code: string; status: string }>,
  edges: HubDictionaryEdge[],
): string[] {
  const { downstream } = getUpstreamDownstream(upstreamCode, edges);
  const affected: string[] = [];
  for (const code of downstream) {
    const row = rows.find((r) => r.code === code);
    if (row && row.status === 'ACTIVE') affected.push(code);
  }
  return affected;
}

export function collectAstKpiRefs(ast: HubFormulaAst): string[] {
  const refs: string[] = [];
  const visit = (node: HubFormulaAst) => {
    if (node.kpi_code) refs.push(node.kpi_code);
    if (node.numerator) visit(node.numerator);
    if (node.denominator) visit(node.denominator);
    if (node.refs) refs.push(...node.refs);
  };
  visit(ast);
  return [...new Set(refs)];
}

function dedupeEdges(edges: HubDictionaryEdge[]): HubDictionaryEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.from}->${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
