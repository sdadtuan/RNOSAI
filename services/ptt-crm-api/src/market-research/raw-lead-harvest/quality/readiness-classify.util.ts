import type { HarvestLeadClassification } from '../harvest-critic.util';

export type RawLeadReadinessStatus =
  | 'READY_TO_PUSH'
  | 'NEEDS_REVIEW'
  | 'MISSING_CONTACT'
  | 'DUPLICATE_OR_BLACKLIST';

export type ReadinessClassifyInput = {
  phone_valid: boolean;
  email_valid: boolean;
  /** Company website (not social-only). */
  company_website_ok: boolean;
  social_only: boolean;
  quality_score: number;
  blacklist_hit: boolean;
  existing_crm_customer: boolean;
  duplicate_phone_in_project: boolean;
  /** Job has industry + province. */
  vertical_ok: boolean;
  territory_ok: boolean;
  /** Configured minimum for READY (default 35). */
  ready_min_score?: number;
};

export type ReadinessClassifyResult = {
  readiness_status: RawLeadReadinessStatus;
  readiness_reason_codes: string[];
  classification: HarvestLeadClassification;
};

const DEFAULT_READY_MIN = 35;

export function classifyRawLeadReadiness(
  input: ReadinessClassifyInput,
): ReadinessClassifyResult {
  const readyMin = input.ready_min_score ?? DEFAULT_READY_MIN;
  const contactPath =
    input.phone_valid || input.email_valid || input.company_website_ok;

  if (input.blacklist_hit) {
    return {
      readiness_status: 'DUPLICATE_OR_BLACKLIST',
      readiness_reason_codes: ['BLACKLIST'],
      classification: 'rejected_blacklist',
    };
  }
  if (input.existing_crm_customer) {
    return {
      readiness_status: 'DUPLICATE_OR_BLACKLIST',
      readiness_reason_codes: ['EXISTING_CUSTOMER'],
      classification: 'rejected_blacklist',
    };
  }
  if (input.duplicate_phone_in_project) {
    return {
      readiness_status: 'DUPLICATE_OR_BLACKLIST',
      readiness_reason_codes: ['DUPLICATE_PHONE'],
      classification: 'rejected_dedupe',
    };
  }

  if (!input.phone_valid && !input.email_valid && !contactPath) {
    const codes: string[] = [];
    if (!input.phone_valid) codes.push('MISSING_PHONE');
    codes.push('NO_VALID_CONTACT_PATH');
    return {
      readiness_status: 'MISSING_CONTACT',
      readiness_reason_codes: codes,
      classification: 'missing_contact',
    };
  }

  if (!input.phone_valid && !input.email_valid) {
    // website-only without phone/email
    return {
      readiness_status: 'MISSING_CONTACT',
      readiness_reason_codes: ['MISSING_PHONE', 'NO_VALID_CONTACT_PATH'],
      classification: 'missing_contact',
    };
  }

  if (
    input.phone_valid &&
    input.vertical_ok &&
    input.territory_ok &&
    input.quality_score >= readyMin &&
    !input.social_only
  ) {
    const codes = ['VALID_PHONE', 'DATA_CONFIDENCE_OK'];
    return {
      readiness_status: 'READY_TO_PUSH',
      readiness_reason_codes: codes,
      classification: 'pass',
    };
  }

  const reviewCodes: string[] = [];
  if (input.social_only) reviewCodes.push('SOCIAL_ONLY');
  if (!input.company_website_ok && !input.social_only) reviewCodes.push('NO_WEBSITE');
  if (input.quality_score < readyMin) reviewCodes.push('LOW_SCORE');
  if (!input.phone_valid) reviewCodes.push('WEAK_DATA');
  if (reviewCodes.length === 0) reviewCodes.push('WEAK_DATA');

  return {
    readiness_status: 'NEEDS_REVIEW',
    readiness_reason_codes: reviewCodes,
    classification: 'needs_review',
  };
}
