import type { ReadinessClassifyInput } from './readiness-classify.util';
import {
  isDenylistedEvidenceHost,
  isDisposableOrExampleEmail,
  isSequentialOrRepeatedPhone,
} from './brq-patterns.util';
import { normalizePhoneDigits } from './literal-contact.util';

export type RawLeadRowLike = {
  phone?: string | null;
  phone_norm?: string | null;
  email?: string | null;
  website?: string | null;
  fanpage_url?: string | null;
  quality_score?: number | null;
  verify_json?: Record<string, unknown> | null;
};

export type ReadinessFromRowContext = {
  blacklist_hit: boolean;
  existing_crm_customer: boolean;
  duplicate_phone_in_project: boolean;
  vertical_ok: boolean;
  territory_ok: boolean;
  ready_min_score?: number;
};

export function buildReadinessInputFromRawLead(
  lead: RawLeadRowLike,
  ctx: ReadinessFromRowContext,
): ReadinessClassifyInput {
  const verify = lead.verify_json ?? {};
  const phoneNorm =
    String(lead.phone_norm ?? '').replace(/\D+/g, '') ||
    (lead.phone ? normalizePhoneDigits(lead.phone) : '');
  const hasPhoneDigits = phoneNorm.length >= 9 && !isSequentialOrRepeatedPhone(phoneNorm);
  const verifyPhoneOk = verify.phone_ok;
  const phone_valid =
    hasPhoneDigits && (verifyPhoneOk === undefined || verifyPhoneOk === null || verifyPhoneOk === true);

  const email = String(lead.email ?? '').trim();
  const hasEmail = Boolean(email) && email.includes('@') && !isDisposableOrExampleEmail(email);
  const verifyEmailOk = verify.email_ok;
  const email_valid =
    hasEmail && (verifyEmailOk === undefined || verifyEmailOk === null || verifyEmailOk === true);

  const website = String(lead.website ?? '').trim();
  const company_website_ok = Boolean(website) && !isDenylistedEvidenceHost(website);
  const fanpage = String(lead.fanpage_url ?? '').trim();
  const social_only = Boolean(fanpage) && !company_website_ok;

  return {
    phone_valid,
    email_valid,
    company_website_ok,
    social_only,
    quality_score: Number(lead.quality_score ?? 0) || 0,
    blacklist_hit: ctx.blacklist_hit,
    existing_crm_customer: ctx.existing_crm_customer,
    duplicate_phone_in_project: ctx.duplicate_phone_in_project,
    vertical_ok: ctx.vertical_ok,
    territory_ok: ctx.territory_ok,
    ready_min_score: ctx.ready_min_score,
  };
}
