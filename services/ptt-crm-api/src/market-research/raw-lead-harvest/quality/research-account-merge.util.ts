import { buildGlobalAccountKey } from './priority-cluster.util';

export type ResearchAccountKeyParts = {
  place_id: string | null;
  phone_norm: string | null;
  domain: string | null;
};

export function parseGlobalAccountKey(key: string | null | undefined): ResearchAccountKeyParts {
  const raw = String(key ?? '').trim();
  if (raw.startsWith('place:')) {
    return { place_id: raw.slice(6) || null, phone_norm: null, domain: null };
  }
  if (raw.startsWith('phone:')) {
    return { place_id: null, phone_norm: raw.slice(6) || null, domain: null };
  }
  if (raw.startsWith('domain:')) {
    return { place_id: null, phone_norm: null, domain: raw.slice(7) || null };
  }
  return { place_id: null, phone_norm: null, domain: null };
}

const TIER_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

export function bestPriorityTier(
  current: string | null | undefined,
  next: string | null | undefined,
): string | null {
  const a = String(current ?? '').toUpperCase();
  const b = String(next ?? '').toUpperCase();
  const ra = TIER_RANK[a];
  const rb = TIER_RANK[b];
  if (ra == null && rb == null) return null;
  if (ra == null) return b;
  if (rb == null) return a;
  return ra <= rb ? a : b;
}

export function resolveGlobalKeyForMerge(lead: {
  id: number;
  global_account_key?: string | null;
  place_id?: string | null;
  phone?: string | null;
  phone_norm?: string | null;
  website?: string | null;
  company_name?: string | null;
}): string | null {
  const existing = String(lead.global_account_key ?? '').trim();
  if (existing) return existing;
  return buildGlobalAccountKey(lead);
}

export function pickDisplayName(
  existing: string | null | undefined,
  candidate: string | null | undefined,
): string {
  const cur = String(existing ?? '').trim();
  if (cur) return cur;
  const next = String(candidate ?? '').trim();
  return next || 'Unknown account';
}
