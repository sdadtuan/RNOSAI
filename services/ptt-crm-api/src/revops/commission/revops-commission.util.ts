/** Commission VND = eligible × rate × split / 10_000 (rate and split are percent). */
export function calcCommissionVnd(eligibleVnd: number, ratePct: number, splitPct: number): number {
  return Math.round((eligibleVnd * ratePct * splitPct) / 10_000);
}

export function pickTierRate(
  tiers: Array<{ min_attainment_pct: number; max_attainment_pct: number | null; rate_pct: number }>,
  attainmentPct: number,
): number | null {
  const sorted = [...tiers].sort((a, b) => Number(b.min_attainment_pct) - Number(a.min_attainment_pct));
  for (const tier of sorted) {
    const min = Number(tier.min_attainment_pct);
    const max = tier.max_attainment_pct == null ? null : Number(tier.max_attainment_pct);
    if (attainmentPct >= min && (max == null || attainmentPct <= max)) {
      return Number(tier.rate_pct);
    }
  }
  return null;
}
