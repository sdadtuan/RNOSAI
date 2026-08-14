import type { InsightGateCode, InsightStatus } from './market-research.constants';

export function evaluateInsightGate(input: {
  verifiedEvidenceCount: number;
  confidenceRationale: string | null | undefined;
}): { ok: true } | { ok: false; error: 'insight_gate'; messages: InsightGateCode[] } {
  const messages: InsightGateCode[] = [];
  if (input.verifiedEvidenceCount < 1) messages.push('missing_verified_evidence');
  if (!String(input.confidenceRationale || '').trim()) messages.push('missing_confidence_rationale');
  if (messages.length) return { ok: false, error: 'insight_gate', messages };
  return { ok: true };
}

export function assertNotSelfApprove(createdBy: string | null, reviewer: string): void {
  if (createdBy && createdBy.trim().toLowerCase() === reviewer.trim().toLowerCase()) {
    const err = new Error('cannot_self_approve');
    (err as Error & { code: string }).code = 'cannot_self_approve';
    throw err;
  }
}

export function canApproveTarget(
  from: InsightStatus,
  target: InsightStatus,
  riskClass: string,
): boolean {
  void riskClass;
  if (target === 'approved_internal') {
    return from === 'analyst_verified' || from === 'peer_reviewed';
  }
  if (target === 'approved_client_facing') return from === 'approved_internal';
  if (target === 'rejected') return true;
  return false;
}
