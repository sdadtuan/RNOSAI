import { createHash } from 'crypto';
import { normalizeCompanyKey } from '../quality/dedupe.util';
import { normalizePhoneDigits } from '../quality/literal-contact.util';

export type MarketContentHashInput = {
  phone?: string | null;
  website?: string | null;
  company_name?: string | null;
  address?: string | null;
};

/** content_hash = sha256(phone_norm|website|company_name_norm|address) */
export function marketEntityContentHash(input: MarketContentHashInput): string {
  const phoneNorm = input.phone ? normalizePhoneDigits(input.phone) || '' : '';
  const website = String(input.website ?? '')
    .trim()
    .toLowerCase();
  const companyNorm = normalizeCompanyKey(String(input.company_name ?? ''));
  const address = String(input.address ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const payload = `${phoneNorm}|${website}|${companyNorm}|${address}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export type MarketEntityChange = 'new' | 'updated' | 'unchanged';

export function classifyMarketEntityChange(
  previousHash: string | null | undefined,
  nextHash: string,
): MarketEntityChange {
  if (!previousHash) return 'new';
  return previousHash === nextHash ? 'unchanged' : 'updated';
}
