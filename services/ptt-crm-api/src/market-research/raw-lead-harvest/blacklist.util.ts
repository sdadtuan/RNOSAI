import { normalizeCompanyKey } from './quality/dedupe.util';
import { normalizePhoneDigits } from './quality/literal-contact.util';

export type BlacklistKind = 'phone' | 'email' | 'company_norm' | 'domain';

export type FeedbackCode =
  | 'bad_phone'
  | 'bad_email'
  | 'fake_company'
  | 'wrong_geo'
  | 'other';

export type DialOutcome =
  | 'connected'
  | 'wrong_number'
  | 'no_answer'
  | 'gatekeeper'
  | 'email_bounced'
  | 'out_of_business';

export const FEEDBACK_CODES: FeedbackCode[] = [
  'bad_phone',
  'bad_email',
  'fake_company',
  'wrong_geo',
  'other',
];

export const DIAL_OUTCOMES: DialOutcome[] = [
  'connected',
  'wrong_number',
  'no_answer',
  'gatekeeper',
  'email_bounced',
  'out_of_business',
];

export type BlacklistEntryInput = {
  kind: BlacklistKind;
  value_norm: string;
  reason: string;
};

export function isFeedbackCode(v: unknown): v is FeedbackCode {
  return typeof v === 'string' && (FEEDBACK_CODES as string[]).includes(v);
}

export function isDialOutcome(v: unknown): v is DialOutcome {
  return typeof v === 'string' && (DIAL_OUTCOMES as string[]).includes(v);
}

export function normalizeBlacklistValue(kind: BlacklistKind, raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (kind === 'phone') return normalizePhoneDigits(s);
  if (kind === 'email') return s.toLowerCase();
  if (kind === 'company_norm') return normalizeCompanyKey(s);
  if (kind === 'domain') {
    try {
      const host = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase();
      return host.replace(/^www\./, '');
    } catch {
      return s.toLowerCase().replace(/^www\./, '');
    }
  }
  return s.toLowerCase();
}

export function blacklistEntriesFromFeedback(input: {
  feedback_code?: FeedbackCode | null;
  dial_outcome?: DialOutcome | null;
  phone?: string | null;
  email?: string | null;
  company_name?: string | null;
  website?: string | null;
}): BlacklistEntryInput[] {
  const out: BlacklistEntryInput[] = [];
  const push = (kind: BlacklistKind, raw: string | null | undefined, reason: string) => {
    if (!raw) return;
    const value_norm = normalizeBlacklistValue(kind, raw);
    if (!value_norm) return;
    out.push({ kind, value_norm, reason });
  };

  if (input.feedback_code === 'bad_phone') {
    push('phone', input.phone, 'feedback:bad_phone');
  }
  if (input.feedback_code === 'bad_email') {
    push('email', input.email, 'feedback:bad_email');
  }
  if (input.feedback_code === 'fake_company') {
    push('company_norm', input.company_name, 'feedback:fake_company');
    if (input.website) push('domain', input.website, 'feedback:fake_company');
  }

  if (input.dial_outcome === 'wrong_number') {
    push('phone', input.phone, 'dial:wrong_number');
  }
  if (input.dial_outcome === 'email_bounced') {
    push('email', input.email, 'dial:email_bounced');
  }
  if (input.dial_outcome === 'out_of_business') {
    push('company_norm', input.company_name, 'dial:out_of_business');
    push('phone', input.phone, 'dial:out_of_business');
    if (input.website) push('domain', input.website, 'dial:out_of_business');
  }

  return out;
}

export function candidateHitsBlacklist(
  candidate: {
    phone_norm?: string | null;
    email?: string | null;
    company_name?: string | null;
    website?: string | null;
  },
  blocked: Array<{ kind: BlacklistKind; value_norm: string }>,
): boolean {
  if (!blocked.length) return false;
  const phone = candidate.phone_norm
    ? normalizeBlacklistValue('phone', candidate.phone_norm)
    : '';
  const email = candidate.email ? normalizeBlacklistValue('email', candidate.email) : '';
  const company = candidate.company_name
    ? normalizeBlacklistValue('company_norm', candidate.company_name)
    : '';
  const domain = candidate.website
    ? normalizeBlacklistValue('domain', candidate.website)
    : '';

  for (const b of blocked) {
    if (b.kind === 'phone' && phone && b.value_norm === phone) return true;
    if (b.kind === 'email' && email && b.value_norm === email) return true;
    if (b.kind === 'company_norm' && company && b.value_norm === company) return true;
    if (b.kind === 'domain' && domain && b.value_norm === domain) return true;
  }
  return false;
}
