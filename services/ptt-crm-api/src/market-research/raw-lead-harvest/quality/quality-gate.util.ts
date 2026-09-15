import type { VerifyResult } from './verify-contact.util';

export type QualityGateMode = 'quality' | 'volume' | 'marketing';

export type QualityGateOutcome = 'pending' | 'auto_rejected';

/**
 * quality: evidence_ok && (phone_ok || email_ok) && score >= 50
 * volume: evidence_ok && score >= 30
 * marketing: evidence_ok && (phone_ok || email_ok) && score >= 35
 *   — email_ok = format hợp lệ (không bắt verify literal); AM dùng gửi marketing
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

  if (mode === 'marketing') {
    if (!v.evidence_ok) return 'auto_rejected';
    if (!v.phone_ok && !v.email_ok) return 'auto_rejected';
    if (score < 35) return 'auto_rejected';
    return 'pending';
  }

  // quality: evidence_ok && (phone_ok || email_ok) && score >= 50
  if (!v.evidence_ok) return 'auto_rejected';
  if (!v.phone_ok && !v.email_ok) return 'auto_rejected';
  if (score < 50) return 'auto_rejected';
  return 'pending';
}
