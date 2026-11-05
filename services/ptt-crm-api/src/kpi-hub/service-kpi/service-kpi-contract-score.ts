export const SCORE_WEIGHTS = {
  classification: 0.25,
  aggressiveness: 0.25,
  assumption: 0.2,
  data: 0.15,
  margin: 0.15,
} as const;

export type ContractScoreInput = {
  classificationRisk: number;
  targetAggressiveness: number;
  assumptionOpen: number;
  dataReadinessGap: number;
  marginPressure: number;
  gmBps: number | null;
  gmFloorBps: number;
};

export type ContractScoreResult = {
  score: number;
  parts: Record<keyof typeof SCORE_WEIGHTS, number>;
  blockSubmit: boolean;
  requiredReviewers: Array<'Finance' | 'GDKD' | 'Strategy'>;
};

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function aggressivenessFromTarget(proposed: number, floor: number, lowerIsBetter: boolean): number {
  if (!Number.isFinite(proposed) || !Number.isFinite(floor) || floor <= 0) return 0;
  if (lowerIsBetter) {
    if (proposed >= floor) return 0;
    return clampPct(((floor - proposed) / floor) * 100);
  }
  if (proposed <= floor) return 0;
  return clampPct(((proposed - floor) / floor) * 100);
}

export function marginPressureFromGm(gmBps: number | null, floorBps: number): number {
  if (gmBps == null || !Number.isFinite(gmBps) || !Number.isFinite(floorBps) || floorBps <= 0) return 0;
  if (gmBps >= floorBps) return 0;
  return clampPct(((floorBps - gmBps) / floorBps) * 100);
}

export function evaluateKpiContractScore(input: ContractScoreInput): ContractScoreResult {
  const parts = {
    classification: clampPct(input.classificationRisk) * SCORE_WEIGHTS.classification,
    aggressiveness: clampPct(input.targetAggressiveness) * SCORE_WEIGHTS.aggressiveness,
    assumption: clampPct(input.assumptionOpen) * SCORE_WEIGHTS.assumption,
    data: clampPct(input.dataReadinessGap) * SCORE_WEIGHTS.data,
    margin: clampPct(input.marginPressure) * SCORE_WEIGHTS.margin,
  };
  const score = Math.round(
    parts.classification + parts.aggressiveness + parts.assumption + parts.data + parts.margin,
  );

  const gmLow = input.gmBps != null && input.gmBps < input.gmFloorBps;
  const aggressive = clampPct(input.targetAggressiveness) >= 25;
  const highScore = score >= 70;
  const blockSubmit = gmLow && (highScore || aggressive);

  const requiredReviewers: ContractScoreResult['requiredReviewers'] = blockSubmit
    ? ['Finance', 'GDKD', 'Strategy']
    : [];

  return { score, parts, blockSubmit, requiredReviewers };
}
