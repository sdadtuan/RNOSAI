export const WIN_SCORE_KEYS = [
  'incumbent',
  'competitor',
  'selection_criteria',
  'switch_risk',
  'champion',
  'next_step',
] as const;

export type WinScoreKey = (typeof WIN_SCORE_KEYS)[number];

export const WIN_THRESHOLDS = { consult: 18, proposal_hint: 24 } as const;

export function computeWinTotal(win: Record<string, number>): number {
  let total = 0;
  for (const key of WIN_SCORE_KEYS) {
    const score = Number(win[key] ?? 0);
    if (score >= 1 && score <= 5) total += score;
  }
  return total;
}
