import type { RawLeadReadinessStatus } from './quality/readiness-classify.util';

export type AcceptReadinessInput = {
  readiness_status?: string | null;
  contactable?: boolean;
};

export type AcceptReadinessResult =
  | { promote: false }
  | {
      promote: true;
      readiness_status: RawLeadReadinessStatus;
      readiness_reason_codes: string[];
      classification: 'pass' | 'needs_review';
    };

/**
 * When staff Accepts a raw lead, optionally promote readiness so Push CRM works.
 */
export function readinessAfterAccept(input: AcceptReadinessInput): AcceptReadinessResult {
  const current = String(input.readiness_status ?? '').trim().toUpperCase();

  if (current === 'READY_TO_PUSH') {
    return { promote: false };
  }

  if (current === 'NEEDS_REVIEW') {
    return {
      promote: true,
      readiness_status: 'READY_TO_PUSH',
      readiness_reason_codes: ['STAFF_ACCEPTED'],
      classification: 'pass',
    };
  }

  if (current === 'MISSING_CONTACT' || current === 'DUPLICATE_OR_BLACKLIST') {
    return { promote: false };
  }

  // Legacy / unclassified
  if (!current) {
    if (input.contactable) {
      return {
        promote: true,
        readiness_status: 'READY_TO_PUSH',
        readiness_reason_codes: ['STAFF_ACCEPTED'],
        classification: 'pass',
      };
    }
    return {
      promote: true,
      readiness_status: 'NEEDS_REVIEW',
      readiness_reason_codes: ['STAFF_ACCEPTED_NEEDS_CONTACT'],
      classification: 'needs_review',
    };
  }

  return { promote: false };
}
