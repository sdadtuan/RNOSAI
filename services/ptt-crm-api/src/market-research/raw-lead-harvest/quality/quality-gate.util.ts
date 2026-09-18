import type { VerifyResult } from './verify-contact.util';

export type QualityGateMode =
  | 'quality'
  | 'volume'
  | 'marketing'
  | 'intent'
  | 'market_graph';

export type QualityGateOutcome = 'pending' | 'auto_rejected';

/**
 * quality: evidence_ok && (phone_ok || email_ok) && score >= 50
 * volume: evidence_ok && score >= 30
 * marketing | intent | market_graph: evidence_ok && (phone_ok || email_ok) && score >= 35
 *   — email_ok = format hợp lệ (không bắt verify literal); AM dùng gửi marketing
 *   — nếu thiếu contact nhưng evidence_ok + score>=25 → pending (staff review website)
 *   — Places phone ground-truth: không cứng reject chỉ vì evidence là Maps/Facebook (BR-Q4/Q9)
 */
export function applyQualityGate(
  mode: QualityGateMode,
  score: number,
  v: VerifyResult,
): QualityGateOutcome {
  if (v.reasons.includes('brq3_generic_company')) {
    return 'auto_rejected';
  }

  const softPlacesModes = mode === 'marketing' || mode === 'intent' || mode === 'market_graph';
  const placesPhoneOk = softPlacesModes && v.phone_ok;
  if (
    !placesPhoneOk &&
    (v.reasons.includes('brq4_search_url') || v.reasons.includes('brq9_denylist_host'))
  ) {
    return 'auto_rejected';
  }

  if (mode === 'volume') {
    return v.evidence_ok && score >= 30 ? 'pending' : 'auto_rejected';
  }

  if (softPlacesModes) {
    if (!v.evidence_ok && !v.phone_ok) return 'auto_rejected';
    if (v.phone_ok || v.email_ok) {
      return score >= 35 ? 'pending' : 'auto_rejected';
    }
    // Soft keep: website evidence without contact → staff review (needs_review)
    return v.evidence_ok && score >= 25 ? 'pending' : 'auto_rejected';
  }

  // quality: evidence_ok && (phone_ok || email_ok) && score >= 50
  if (v.reasons.includes('brq4_search_url') || v.reasons.includes('brq9_denylist_host')) {
    return 'auto_rejected';
  }
  if (!v.evidence_ok) return 'auto_rejected';
  if (!v.phone_ok && !v.email_ok) return 'auto_rejected';
  if (score < 50) return 'auto_rejected';
  return 'pending';
}
