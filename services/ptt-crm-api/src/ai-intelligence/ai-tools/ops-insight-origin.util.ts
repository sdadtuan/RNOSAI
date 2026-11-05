/** P8.3 — Insight origin for presales AI drafts vs manual research. */

export type InsightOrigin = 'presales_ai' | 'research_manual';

export type InsightOriginFields = {
  ai_generated?: boolean | null;
  statement?: string | null;
  confidence_rationale?: string | null;
  confidence_json?: unknown;
  title?: string | null;
};

const PRESALES_SOURCE_TOOL = 'insight.draft_from_presales';

export function parseConfidenceObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, unknown>;
}

export function detectInsightOrigin(row: InsightOriginFields): InsightOrigin {
  const cj = parseConfidenceObject(row.confidence_json);
  if (cj.origin === 'presales_ai' || cj.source_tool === PRESALES_SOURCE_TOOL) {
    return 'presales_ai';
  }
  const aiDraft = cj.ai_draft;
  if (aiDraft && typeof aiDraft === 'object' && (aiDraft as { presales?: unknown }).presales === true) {
    return 'presales_ai';
  }

  const statement = String(row.statement ?? '');
  const rationale = String(row.confidence_rationale ?? '');
  const title = String(row.title ?? '');
  if (
    /\[P7\]/i.test(statement) ||
    /\[P7\]/i.test(title) ||
    /insight\.draft_from_presales|cannot_approve_via_tool|P7 insight/i.test(rationale)
  ) {
    return 'presales_ai';
  }

  // P7 createPendingInsight always sets ai_generated=TRUE for this tool.
  if (Boolean(row.ai_generated)) return 'presales_ai';

  return 'research_manual';
}

export function buildPresalesDraftConfidenceJson(
  existing?: unknown,
): Record<string, unknown> {
  const base = parseConfidenceObject(existing);
  return {
    ...base,
    origin: 'presales_ai',
    source_tool: PRESALES_SOURCE_TOOL,
    ai_draft: { ...(typeof base.ai_draft === 'object' && base.ai_draft ? base.ai_draft : {}), presales: true },
  };
}

/** Default 5-dim rubric labeled assumed_from_presales (AM can edit later). */
export function buildPresalesAssumedRubric(
  existing?: unknown,
): Record<string, unknown> {
  const base = parseConfidenceObject(existing);
  const nested =
    base.rubric && typeof base.rubric === 'object'
      ? (base.rubric as Record<string, unknown>)
      : base;
  const dim = (key: string, fallback: number) => {
    const n = Number(nested[key]);
    return Number.isFinite(n) && n >= 0 && n <= 4 ? n : fallback;
  };
  return {
    ...buildPresalesDraftConfidenceJson(base),
    rubric: {
      S: dim('S', 2),
      F: dim('F', 2),
      T: dim('T', 2),
      A: dim('A', 2),
      R: dim('R', 2),
      statistical_inference: Boolean(nested.statistical_inference),
    },
    S: dim('S', 2),
    F: dim('F', 2),
    T: dim('T', 2),
    A: dim('A', 2),
    R: dim('R', 2),
    statistical_inference: Boolean(nested.statistical_inference),
    assumed_from_presales: true,
    band: 'medium',
  };
}

export { PRESALES_SOURCE_TOOL };
