export function briefCompleteness(brief: Record<string, unknown>, weights: Record<string, number>): number {
  const keys = Object.keys(weights);
  const sumW = keys.reduce((s, k) => s + weights[k], 0) || 1;
  const done = keys.reduce((s, k) => {
    const v = brief[k];
    const filled = v != null && String(v).trim() !== '' && !(Array.isArray(v) && v.length === 0);
    return s + (filled ? weights[k] : 0);
  }, 0);
  return Math.round((done / sumW) * 100);
}

export const DEFAULT_BRIEF_WEIGHTS = {
  objective: 15,
  funnel: 10,
  persona: 8,
  smm: 15,
  proofs: 12,
  restricted: 10,
  disclaimer: 15,
  cta: 10,
  kpi: 5,
};

export function briefScoreThreshold(riskLevel?: string | null): number {
  return riskLevel === 'Brand-Sensitive' || riskLevel === 'Regulated' ? 95 : 80;
}

const ENTERPRISE_BRIEF_KEYS = Object.keys(DEFAULT_BRIEF_WEIGHTS);

const APPROVED_BODY_PATH = new Set([
  'approved_internal',
  'pending_client',
  'client_approved',
  'scheduled',
]);

function isFilled(value: unknown): boolean {
  return value != null && String(value).trim() !== '' && !(Array.isArray(value) && value.length === 0);
}

function firstFilled(...values: unknown[]): unknown {
  return values.find((value) => isFilled(value));
}

/** True when any plan weight key is actually present on the raw brief (not aliases). */
export function usesEnterpriseBrief(brief: Record<string, unknown> | null | undefined): boolean {
  if (!brief) return false;
  return ENTERPRISE_BRIEF_KEYS.some((key) => Object.prototype.hasOwnProperty.call(brief, key));
}

/** Gate-only aliases. Does not mutate DEFAULT_BRIEF_WEIGHTS or persist a rewritten brief. */
export function normalizeBriefForGate(
  brief: Record<string, unknown> | null | undefined,
  item?: { funnel_goal?: string | null },
): Record<string, unknown> {
  const raw = brief ?? {};
  return {
    ...raw,
    objective: firstFilled(raw.objective, raw.goal) ?? raw.objective,
    funnel: firstFilled(raw.funnel, raw.funnel_goal, item?.funnel_goal) ?? raw.funnel,
    persona: firstFilled(raw.persona, raw.audience) ?? raw.persona,
    smm: firstFilled(raw.smm, raw.hook) ?? raw.smm,
    proofs: firstFilled(raw.proofs, raw.usp) ?? raw.proofs,
  };
}

export function generatePathBriefReady(
  brief: Record<string, unknown> | null | undefined,
  item?: { funnel_goal?: string | null },
): boolean {
  const raw = brief ?? {};
  const audienceOk = isFilled(raw.audience) || isFilled(raw.persona);
  const goalOk = isFilled(raw.goal) || isFilled(raw.objective) || isFilled(item?.funnel_goal);
  return audienceOk && goalOk;
}

export function gateBriefScore(
  brief: Record<string, unknown> | null | undefined,
  item?: { funnel_goal?: string | null },
): number {
  return briefCompleteness(normalizeBriefForGate(brief, item), DEFAULT_BRIEF_WEIGHTS);
}

export function briefReadyForPublish(item: {
  brief_json?: Record<string, unknown> | null;
  funnel_goal?: string | null;
  risk_level?: string | null;
  status?: string | null;
  body_json?: { markdown?: string } | null;
}): boolean {
  const brief = item.brief_json ?? {};
  if (usesEnterpriseBrief(brief)) {
    return gateBriefScore(brief, item) >= briefScoreThreshold(item.risk_level);
  }
  if (generatePathBriefReady(brief, item)) return true;
  const approvedPath = APPROVED_BODY_PATH.has(String(item.status ?? ''));
  const bodyReady = Boolean(String(item.body_json?.markdown ?? '').trim());
  return approvedPath && bodyReady;
}
