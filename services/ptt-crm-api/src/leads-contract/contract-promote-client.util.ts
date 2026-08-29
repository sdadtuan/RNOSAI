import type { AgencyClientLinkMode } from './contract.types';

const CODE_SUFFIXES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function resolvePromoteClientName(meta: Record<string, unknown>, fullName: string): string {
  const company = String(meta.company ?? '').trim();
  if (company) return company.slice(0, 240);
  const companyName = String(meta.company_name ?? '').trim();
  if (companyName) return companyName.slice(0, 240);
  return String(fullName ?? '').trim().slice(0, 240) || 'Client';
}

export function generatePromoteClientCode(leadId: number, takenCodes: Set<string>): string {
  const base = `L${leadId}`.toUpperCase();
  if (!takenCodes.has(base)) return base;
  for (const suffix of CODE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (!takenCodes.has(candidate)) return candidate;
  }
  let n = 2;
  while (n < 100) {
    const candidate = `${base}${n}`;
    if (!takenCodes.has(candidate)) return candidate;
    n += 1;
  }
  return `${base}Z`.slice(0, 31);
}

export function buildPromoteClientNotes(
  contractId: number,
  leadId: number,
  lifecycleId: number,
  needsMerge: boolean,
): string {
  const line = `Promote HĐ #${contractId} · Lead #${leadId} · lifecycle #${lifecycleId}`;
  return needsMerge ? `${line} · [needs_merge]` : line;
}

export function pickDedupClientId(candidates: string[]): {
  mode: AgencyClientLinkMode;
  clientId: string | null;
  ambiguousIds: string[];
} {
  const ids = candidates.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return { mode: 'created', clientId: null, ambiguousIds: [] };
  }
  if (ids.length === 1) {
    return { mode: 'link_dedup_name', clientId: ids[0], ambiguousIds: [] };
  }
  return { mode: 'link_ambiguous', clientId: null, ambiguousIds: ids };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidClientUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
