import type { ImgQcDimension, ImgQcProfile } from './cp-image-sop.types';

const PROFILE_REQUIRED: Record<ImgQcProfile, ImgQcDimension[]> = {
  brand_kv_v1: ['technical', 'brand_fit', 'creative_fit', 'delivery'],
  product_fidelity_v2: ['technical', 'product_fidelity', 'delivery'],
  social_cta_vn_v1: ['technical', 'text_cta_vn', 'brand_fit', 'delivery'],
};

export function evaluateQuality(input: {
  profile: ImgQcProfile;
  checks: Partial<Record<ImgQcDimension, number | null>>;
}): {
  scores_json: Record<string, number | null>;
  decision: 'PASS' | 'WARN' | 'FAIL' | 'ESCALATE';
} {
  const required = PROFILE_REQUIRED[input.profile] ?? [];
  const scores_json: Record<string, number | null> = {};
  let hasFail = false;
  let hasWarn = false;
  let hasNullRequired = false;

  for (const dim of required) {
    const score = input.checks[dim] ?? null;
    scores_json[dim] = score;
    if (score == null) {
      hasNullRequired = true;
      continue;
    }
    if (score < 60) hasFail = true;
    else if (score < 80) hasWarn = true;
  }

  for (const [dim, score] of Object.entries(input.checks)) {
    if (!(dim in scores_json)) scores_json[dim] = score ?? null;
  }

  if (hasFail) return { scores_json, decision: 'FAIL' };
  if (hasNullRequired) return { scores_json, decision: 'ESCALATE' };
  if (hasWarn) return { scores_json, decision: 'WARN' };
  return { scores_json, decision: 'PASS' };
}
