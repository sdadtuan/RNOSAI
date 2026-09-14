import { normalizePhoneDigits } from './literal-contact.util';

export function normalizeCompanyKey(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export type DedupeKey = {
  company_key: string;
  phone_norm: string | null;
  email_norm: string | null;
};

export function buildDedupeKey(input: {
  company_name: string;
  phone_norm?: string | null;
  email?: string | null;
}): DedupeKey {
  return {
    company_key: normalizeCompanyKey(input.company_name),
    phone_norm: input.phone_norm ? normalizePhoneDigits(input.phone_norm) : null,
    email_norm: input.email ? String(input.email).trim().toLowerCase() : null,
  };
}

/** Same project: match by phone OR (company+email) OR exact company_key when phone/email empty. */
export function isDuplicateAgainst(
  candidate: DedupeKey,
  existing: DedupeKey[],
): boolean {
  for (const e of existing) {
    if (candidate.phone_norm && e.phone_norm && candidate.phone_norm === e.phone_norm) {
      return true;
    }
    if (
      candidate.email_norm &&
      e.email_norm &&
      candidate.email_norm === e.email_norm &&
      candidate.company_key === e.company_key
    ) {
      return true;
    }
    if (
      candidate.company_key &&
      candidate.company_key === e.company_key &&
      !candidate.phone_norm &&
      !candidate.email_norm
    ) {
      return true;
    }
  }
  return false;
}
