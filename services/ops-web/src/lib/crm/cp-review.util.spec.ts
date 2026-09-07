import { describe, expect, it } from 'vitest';
import {
  APPROVAL_STATES,
  QC_CHECK_KEYS,
  approvalStepForStatus,
  rollupQcResult,
} from './cp-review.util';

describe('cp-review.util', () => {
  it('lists the ten QC check keys in SRS order', () => {
    expect(QC_CHECK_KEYS).toEqual([
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
    ]);
  });

  it('lists the seven approval states', () => {
    expect(APPROVAL_STATES).toEqual([
      'internal_review',
      'client_review',
      'changes_requested',
      'brand_approved',
      'legal_approved',
      'final_approved',
      'rejected',
    ]);
  });

  it('rolls up blocked over warning over passed', () => {
    expect(rollupQcResult(['passed', 'warning', 'passed'])).toBe('warning');
    expect(rollupQcResult(['passed', 'blocked', 'warning'])).toBe('blocked');
    expect(rollupQcResult(['passed', 'passed'])).toBe('passed');
  });

  it('maps approval status to crm_cp_approvals step', () => {
    expect(approvalStepForStatus('brand_approved')).toBe('brand');
    expect(approvalStepForStatus('legal_approved')).toBe('legal');
    expect(approvalStepForStatus('final_approved')).toBe('final');
    expect(approvalStepForStatus('client_review')).toBe('client_review');
    expect(approvalStepForStatus('changes_requested')).toBe('internal_review');
  });
});
