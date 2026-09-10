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
