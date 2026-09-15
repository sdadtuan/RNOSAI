import type { VerifyResult } from './verify-contact.util';

export type QualityGateMode = 'quality' | 'volume' | 'marketing' | 'intent';

export type QualityGateOutcome = 'pending' | 'auto_rejected';

/**
 * quality: evidence_ok && (phone_ok || email_ok) && score >= 50
 * volume: evidence_ok && score >= 30
 * marketing | intent: evidence_ok && (phone_ok || email_ok) && score >= 35
 *   — email_ok = format hợp lệ (không bắt verify literal); AM dùng gửi marketing
 *   — nếu thiếu contact nhưng evidence_ok + score>=25 → pending (staff review website)
 */
export function applyQualityGate(
  mode: QualityGateMode,
  score: number,
  v: VerifyResult,
): QualityGateOutcome {
  if (
    v.reasons.includes('brq3_generic_company') ||
    v.reasons.includes('brq4_search_url') ||
    v.reasons.includes('brq9_denylist_host')
  ) {
    return 'auto_rejected';
  }

  if (mode === 'volume') {
    return v.evidence_ok && score >= 30 ? 'pending' : 'auto_rejected';
  }

  if (mode === 'marketing' || mode === 'intent') {
    if (!v.evidence_ok) return 'auto_rejected';
    if (v.phone_ok || v.email_ok) {
      return score >= 35 ? 'pending' : 'auto_rejected';
    }
    // Soft keep: website evidence without contact → staff review (needs_review)
    return score >= 25 ? 'pending' : 'auto_rejected';
  }

  // quality: evidence_ok && (phone_ok || email_ok) && score >= 50
  if (!v.evidence_ok) return 'auto_rejected';
  if (!v.phone_ok && !v.email_ok) return 'auto_rejected';
  if (score < 50) return 'auto_rejected';
  return 'pending';
}
