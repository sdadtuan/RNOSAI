export type BulkAcceptCandidate = {
  id: number;
  status: string;
  readiness_status?: string | null;
};

export function filterBulkAcceptCandidates(
  leads: BulkAcceptCandidate[],
): BulkAcceptCandidate[] {
  return leads.filter((l) => {
    const status = String(l.status ?? '').toLowerCase();
    if (status === 'pushed' || status === 'rejected') return false;
    if (status !== 'pending' && status !== 'accepted') return false;
    const ready = String(l.readiness_status ?? '').toUpperCase();
    // Prefer review / ready / unclassified; skip missing & dup (Accept won't help)
    if (ready === 'MISSING_CONTACT' || ready === 'DUPLICATE_OR_BLACKLIST') {
      return false;
    }
    return true;
  });
}

export function selectIdsByReadiness(
  leads: Array<{ id: number; readiness_status?: string | null; status?: string }>,
  readiness: 'READY_TO_PUSH' | 'NEEDS_REVIEW',
): number[] {
  return leads
    .filter((l) => {
      if (String(l.status ?? '').toLowerCase() === 'pushed') return false;
      return String(l.readiness_status ?? '').toUpperCase() === readiness;
    })
    .map((l) => l.id);
}
