const QUOTE_PHASES_PAST_PLAN = new Set(['chuyen_bao_gia', 'bao_gia', 'sale_review', 'hop_dong', 'trien_khai']);

/** R5 is only the gate while Tư vấn can still go straight to Báo giá. */
export function showPreliminaryMarketingPlan(input: {
  stage?: string | null;
  handoffStatus?: string | null;
  quotePhase?: string | null;
}): boolean {
  if (String(input.stage ?? '').trim() !== 'consult') return false;
  const handoff = String(input.handoffStatus ?? '').trim();
  if (handoff === 'pending' || handoff === 'with_solution' || handoff === 'released') return false;
  if (QUOTE_PHASES_PAST_PLAN.has(String(input.quotePhase ?? '').trim())) return false;
  return true;
}
