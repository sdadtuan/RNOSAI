export type CriticFlag =
  | 'keep'
  | 'weak_contact'
  | 'weak_evidence'
  | 'generic_name'
  | 'likely_fabricated'
  | 'other';

/** Persisted on lead row — staff-facing classification. */
export type HarvestLeadClassification =
  | 'pass'
  | 'needs_review'
  | 'missing_contact'
  | 'rejected_critic'
  | 'rejected_gate'
  | 'rejected_blacklist'
  | 'rejected_dedupe';

export type CriticRowVerdict = {
  flag: CriticFlag;
  reason: string | null;
};

const FLAG_SET = new Set<CriticFlag>([
  'keep',
  'weak_contact',
  'weak_evidence',
  'generic_name',
  'likely_fabricated',
  'other',
]);

export function normalizeCriticFlag(raw: unknown): CriticFlag {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (FLAG_SET.has(s as CriticFlag)) return s as CriticFlag;
  if (s === 'drop' || s === 'reject') return 'likely_fabricated';
  return 'keep';
}

/**
 * Legacy critic returned `[0,2]` drop indexes. New format:
 * `[{index, class, reason}]`. Always returns a map covering 0..len-1 (default keep).
 */
export function parseCriticClassifications(
  raw: string,
  len: number,
): Map<number, CriticRowVerdict> {
  const out = new Map<number, CriticRowVerdict>();
  for (let i = 0; i < len; i += 1) {
    out.set(i, { flag: 'keep', reason: null });
  }
  if (len <= 0) return out;

  const text = String(raw ?? '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return out;

  let arr: unknown;
  try {
    arr = JSON.parse(text.slice(start, end + 1));
  } catch {
    return out;
  }
  if (!Array.isArray(arr)) return out;

  const allNumbers = arr.length > 0 && arr.every((x) => Number.isInteger(Number(x)));
  if (allNumbers) {
    for (const n of arr) {
      const idx = Number(n);
      if (idx >= 0 && idx < len) {
        out.set(idx, {
          flag: 'likely_fabricated',
          reason: 'critic_drop_index',
        });
      }
    }
    return out;
  }

  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const idx = Number(r.index ?? r.i ?? r.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= len) continue;
    out.set(idx, {
      flag: normalizeCriticFlag(r.class ?? r.flag ?? r.verdict),
      reason: r.reason == null ? null : String(r.reason).slice(0, 300),
    });
  }
  return out;
}

export function applyCriticFlagToLead(flag: CriticFlag): {
  forceReject: boolean;
  classification: HarvestLeadClassification;
} {
  if (flag === 'keep') {
    return { forceReject: false, classification: 'pass' };
  }
  if (flag === 'weak_contact') {
    // Soft: keep for quality gate / staff review — do not silent-drop.
    return { forceReject: false, classification: 'needs_review' };
  }
  if (flag === 'other') {
    return { forceReject: false, classification: 'needs_review' };
  }
  // weak_evidence | generic_name | likely_fabricated
  return { forceReject: true, classification: 'rejected_critic' };
}

export function resolveLeadClassification(input: {
  criticFlag: CriticFlag;
  forceReject: boolean;
  status: string;
  blacklistHit?: boolean;
  dedupeHit?: boolean;
}): HarvestLeadClassification {
  if (input.blacklistHit) return 'rejected_blacklist';
  if (input.dedupeHit) return 'rejected_dedupe';
  const fromCritic = applyCriticFlagToLead(input.criticFlag);
  if (fromCritic.forceReject || input.forceReject) {
    if (fromCritic.classification === 'rejected_critic') return 'rejected_critic';
  }
  if (input.status === 'auto_rejected') {
    if (fromCritic.classification === 'needs_review') return 'needs_review';
    return 'rejected_gate';
  }
  if (fromCritic.classification === 'needs_review') return 'needs_review';
  return 'pass';
}
