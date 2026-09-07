export const QC_CHECK_KEYS = [
  'technical',
  'safe_area',
  'caption_overflow',
  'logo',
  'cta',
  'disclaimer',
  'missing_audio',
  'loudness',
  'black_frozen',
  'moderation',
] as const;

export type QcCheckKey = (typeof QC_CHECK_KEYS)[number];
export type QcResult = 'passed' | 'warning' | 'blocked';

export const APPROVAL_STATES = [
  'internal_review',
  'client_review',
  'changes_requested',
  'brand_approved',
  'legal_approved',
  'final_approved',
  'rejected',
] as const;

export type CpApprovalState = (typeof APPROVAL_STATES)[number];

export const QC_CHECK_LABELS: Record<QcCheckKey, string> = {
  technical: 'Technical',
  safe_area: 'Safe area',
  caption_overflow: 'Caption overflow',
  logo: 'Logo',
  cta: 'CTA',
  disclaimer: 'Disclaimer',
  missing_audio: 'Missing audio',
  loudness: 'Loudness',
  black_frozen: 'Black / frozen',
  moderation: 'Moderation',
};

export const APPROVAL_LABELS: Record<CpApprovalState, string> = {
  internal_review: 'Internal review',
  client_review: 'Client review',
  changes_requested: 'Changes requested',
  brand_approved: 'Brand approved',
  legal_approved: 'Legal approved',
  final_approved: 'Final approved',
  rejected: 'Rejected',
};

export function rollupQcResult(results: Array<QcResult | null | undefined>): QcResult {
  if (results.includes('blocked')) return 'blocked';
  if (results.includes('warning')) return 'warning';
  return 'passed';
}

export function approvalStepForStatus(status: string): string {
  switch (status) {
    case 'client_review':
      return 'client_review';
    case 'brand_approved':
      return 'brand';
    case 'legal_approved':
      return 'legal';
    case 'final_approved':
      return 'final';
    default:
      return 'internal_review';
  }
}

export function isApprovalState(value: string): value is CpApprovalState {
  return (APPROVAL_STATES as readonly string[]).includes(value);
}

export type QcFetchState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'resolved'; qcStatus: string | null };

export function canSubmitCreativeToHub(
  versionId: string | null | undefined,
  qcFetch: QcFetchState,
): boolean {
  if (!versionId) return false;
  if (qcFetch.phase !== 'resolved') return false;
  return qcFetch.qcStatus !== 'blocked';
}
