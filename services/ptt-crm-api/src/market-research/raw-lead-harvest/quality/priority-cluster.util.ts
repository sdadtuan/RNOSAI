import { normalizeCompanyKey } from './dedupe.util';
import { normalizePhoneDigits } from './literal-contact.util';
import { isDenylistedEvidenceHost } from './brq-patterns.util';

export type PriorityTier = 'P1' | 'P2' | 'P3';

export type PriorityClusterLead = {
  id: number;
  company_name?: string | null;
  company_name_norm?: string | null;
  phone?: string | null;
  phone_norm?: string | null;
  website?: string | null;
  place_id?: string | null;
  readiness_status?: string | null;
  quality_score?: number | null;
  contactable?: boolean;
};

export function extractRegistrableDomain(website: string | null | undefined): string | null {
  const raw = String(website ?? '').trim();
  if (!raw) return null;
  if (isDenylistedEvidenceHost(raw)) return null;
  try {
    const host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname
      .toLowerCase()
      .replace(/^www\./, '');
    if (!host || host.length < 3) return null;
    return host;
  } catch {
    return null;
  }
}

export function buildAccountClusterKey(lead: PriorityClusterLead): string {
  const placeId = String(lead.place_id ?? '').trim();
  if (placeId) return `place:${placeId}`;

  const phoneNorm =
    String(lead.phone_norm ?? '').replace(/\D+/g, '') ||
    (lead.phone ? normalizePhoneDigits(lead.phone) : '');
  if (phoneNorm.length >= 9) return `phone:${phoneNorm}`;

  const domain = extractRegistrableDomain(lead.website);
  if (domain) return `domain:${domain}`;

  const nameNorm =
    String(lead.company_name_norm ?? '').trim() ||
    normalizeCompanyKey(String(lead.company_name ?? ''));
  if (nameNorm.length >= 3) return `name:${nameNorm}`;

  return `id:${lead.id}`;
}

export function computePriorityTier(input: {
  readiness_status?: string | null;
  quality_score?: number | null;
  contactable?: boolean;
  phone_norm?: string | null;
  phone?: string | null;
}): PriorityTier {
  const ready = String(input.readiness_status ?? '').trim().toUpperCase();
  const score = Number(input.quality_score ?? 0) || 0;
  const phoneNorm =
    String(input.phone_norm ?? '').replace(/\D+/g, '') ||
    (input.phone ? normalizePhoneDigits(input.phone) : '');
  const hasPhone = phoneNorm.length >= 9;
  const contactable = Boolean(input.contactable) || hasPhone;

  if (ready === 'READY_TO_PUSH' && contactable && score >= 50) return 'P1';
  if (ready === 'READY_TO_PUSH') return 'P2';
  if (ready === 'NEEDS_REVIEW' && hasPhone) return 'P2';
  return 'P3';
}
