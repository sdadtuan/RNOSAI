import type { VerifyResult } from './verify-contact.util';

/**
 * SRS §9A.2 weights: evidence 25, phone 25, email 20, geo 15, website 10, conf 5.
 */
export function computeQualityScore(
  v: VerifyResult,
  confidence: number | null | undefined,
): number {
  let score = 0;
  if (v.evidence_ok) score += 25;
  if (v.phone_ok) score += 25;
  if (v.email_ok) score += 20;
  if (v.geo_ok) score += 15;
  if (v.website_domain_ok) score += 10;
  const conf = typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 0;
  score += Math.round(conf * 5);
  return Math.max(0, Math.min(100, score));
}
