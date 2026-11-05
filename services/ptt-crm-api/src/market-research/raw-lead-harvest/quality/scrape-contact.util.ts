import { normalizePhoneDigits } from './literal-contact.util';
import { isDisposableOrExampleEmail, isSequentialOrRepeatedPhone } from './brq-patterns.util';

export type ScrapedContacts = {
  phone: string | null;
  email: string | null;
  phones: string[];
  emails: string[];
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
/** VN mobile 09/03/05/07/08 + landline 0x… (9–11 digits after 0). */
const PHONE_CANDIDATE_RE =
  /(?:\+?84|0)\s*[.\-]?[1-9](?:[\s.\-]?\d){7,9}\b/g;

function classifyPhone(digits: string): 'mobile' | 'landline' | 'unknown' {
  if (/^0(3|5|7|8|9)\d{8}$/.test(digits)) return 'mobile';
  if (/^0\d{9,10}$/.test(digits)) return 'landline';
  return 'unknown';
}

function formatVnPhone(digits: string): string {
  return digits;
}

function isJunkEmail(email: string): boolean {
  const e = email.toLowerCase();
  if (isDisposableOrExampleEmail(e)) return true;
  if (/^(noreply|no-reply|donotreply|mailer-daemon|webmaster|postmaster)@/i.test(e)) {
    return true;
  }
  if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(e)) return true;
  return false;
}

/**
 * Deterministic scrape of VN phones + emails from evidence HTML/text.
 * Used when the LLM discover/extract pass leaves phone/email null.
 */
export function scrapeContactsFromText(text: string): ScrapedContacts {
  const hay = String(text ?? '');
  const phones: string[] = [];
  const seenPhone = new Set<string>();
  for (const raw of hay.match(PHONE_CANDIDATE_RE) ?? []) {
    const digits = normalizePhoneDigits(raw);
    if (digits.length < 9 || digits.length > 11) continue;
    if (!digits.startsWith('0')) continue;
    if (isSequentialOrRepeatedPhone(digits)) continue;
    if (classifyPhone(digits) === 'unknown' && digits.length < 10) continue;
    if (seenPhone.has(digits)) continue;
    seenPhone.add(digits);
    phones.push(formatVnPhone(digits));
  }
  phones.sort((a, b) => {
    const ca = classifyPhone(a);
    const cb = classifyPhone(b);
    if (ca === 'mobile' && cb !== 'mobile') return -1;
    if (cb === 'mobile' && ca !== 'mobile') return 1;
    return 0;
  });

  const emails: string[] = [];
  const seenEmail = new Set<string>();
  for (const raw of hay.match(EMAIL_RE) ?? []) {
    const e = raw.toLowerCase();
    if (isJunkEmail(e)) continue;
    if (seenEmail.has(e)) continue;
    seenEmail.add(e);
    emails.push(e);
  }

  return {
    phone: phones[0] ?? null,
    email: emails[0] ?? null,
    phones,
    emails,
  };
}

/** Likely contact/lien-he paths for a homepage evidence URL. */
export function contactPageUrls(evidenceUrl: string): string[] {
  try {
    const u = new URL(evidenceUrl);
    if (!/^https?:$/i.test(u.protocol)) return [];
    const origin = u.origin;
    const paths = [
      '/lien-he',
      '/lienhe',
      '/contact',
      '/contact-us',
      '/pages/lien-he',
      '/gioi-thieu/lien-he',
    ];
    const current = u.pathname.replace(/\/+$/, '').toLowerCase();
    return paths
      .filter((p) => current !== p && !current.endsWith(p))
      .map((p) => `${origin}${p}`);
  } catch {
    return [];
  }
}

export function mergeScrapedContacts(
  ai: { phone: string | null; email: string | null },
  scraped: ScrapedContacts,
): { phone: string | null; email: string | null; scraped: boolean } {
  const phone = (ai.phone?.trim() || scraped.phone || null) as string | null;
  const email = (ai.email?.trim() || scraped.email || null) as string | null;
  return {
    phone,
    email,
    scraped: Boolean((!ai.phone?.trim() && scraped.phone) || (!ai.email?.trim() && scraped.email)),
  };
}
