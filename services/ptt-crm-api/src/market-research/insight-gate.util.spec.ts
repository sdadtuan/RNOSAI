import { assertNotSelfApprove, canApproveTarget, evaluateInsightGate } from './insight-gate.util';

describe('evaluateInsightGate', () => {
  it('returns missing_verified_evidence when verifiedEvidenceCount is 0', () => {
    expect(
      evaluateInsightGate({ verifiedEvidenceCount: 0, confidenceRationale: 'Method OK' }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['missing_verified_evidence'],
    });
  });

  it('returns missing_confidence_rationale when rationale is empty', () => {
    expect(
      evaluateInsightGate({ verifiedEvidenceCount: 1, confidenceRationale: '   ' }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['missing_confidence_rationale'],
    });
  });

  it('returns both codes when evidence and rationale are missing', () => {
    expect(
      evaluateInsightGate({ verifiedEvidenceCount: 0, confidenceRationale: null }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['missing_verified_evidence', 'missing_confidence_rationale'],
    });
  });

  it('returns ok when both evidence and rationale are present', () => {
    expect(
      evaluateInsightGate({ verifiedEvidenceCount: 1, confidenceRationale: 'Nguồn verified, sample 2025' }),
    ).toEqual({ ok: true });
  });
});

describe('assertNotSelfApprove', () => {
  it('throws cannot_self_approve when emails match', () => {
    expect(() => assertNotSelfApprove('a@x', 'a@x')).toThrow();
    try {
      assertNotSelfApprove('a@x', 'a@x');
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('cannot_self_approve');
      expect((err as Error).message).toBe('cannot_self_approve');
    }
  });

  it('does not throw when emails differ', () => {
    expect(() => assertNotSelfApprove('a@x', 'b@x')).not.toThrow();
  });
});

describe('canApproveTarget', () => {
  it('allows analyst_verified → approved_internal at low risk', () => {
    expect(canApproveTarget('analyst_verified', 'approved_internal', 'low')).toBe(true);
  });

  it('rejects draft → approved_internal', () => {
    expect(canApproveTarget('draft', 'approved_internal', 'low')).toBe(false);
  });

  it('allows approved_internal → approved_client_facing', () => {
    expect(canApproveTarget('approved_internal', 'approved_client_facing', 'low')).toBe(true);
  });
});
