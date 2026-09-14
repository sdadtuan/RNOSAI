import {
  companyNameAppearsInText,
  emailAppearsInText,
  normalizePhoneDigits,
  phoneAppearsInText,
} from './literal-contact.util';
import {
  emailDomainMatchesWebsite,
  isDenylistedEvidenceHost,
  isDisposableOrExampleEmail,
  isGenericCompanyName,
  isSearchEvidenceUrl,
  isSequentialOrRepeatedPhone,
} from './brq-patterns.util';
import type { EvidenceFetchResult } from './evidence-fetch.util';

export type HarvestCandidate = {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_title: string | null;
  website: string | null;
  evidence_url: string;
  evidence_snippet: string | null;
  discovered_via_source_key: string | null;
  confidence: number | null;
};

export type VerifyResult = {
  evidence_ok: boolean;
  phone_ok: boolean;
  email_ok: boolean;
  geo_ok: boolean;
  title_ok: boolean;
  website_domain_ok: boolean;
  fetch: 'ok' | 'fail' | 'skip';
  reasons: string[];
  phone_kind?: 'mobile' | 'landline' | 'unknown';
  phone_norm: string | null;
  phone_out: string | null;
  email_out: string | null;
};

function classifyPhone(digits: string): 'mobile' | 'landline' | 'unknown' {
  if (/^0(3|5|7|8|9)\d{8}$/.test(digits)) return 'mobile';
  if (/^0\d{9,10}$/.test(digits)) return 'landline';
  return 'unknown';
}

export function verifyCandidate(
  c: HarvestCandidate,
  fetch: EvidenceFetchResult | null,
  opts?: { expectedProvinceHint?: string | null },
): VerifyResult {
  const reasons: string[] = [];
  let phone_out = c.phone?.trim() || null;
  let email_out = c.email?.trim() || null;
  let phone_norm: string | null = phone_out ? normalizePhoneDigits(phone_out) : null;

  if (isGenericCompanyName(c.company_name)) {
    reasons.push('brq3_generic_company');
  }
  if (isSearchEvidenceUrl(c.evidence_url)) {
    reasons.push('brq4_search_url');
  }
  if (isDenylistedEvidenceHost(c.evidence_url)) {
    reasons.push('brq9_denylist_host');
  }

  let fetchStatus: 'ok' | 'fail' | 'skip' = 'skip';
  let body = '';
  if (fetch) {
    fetchStatus = fetch.ok ? 'ok' : 'fail';
    body = fetch.text || '';
  }

  const snippet = String(c.evidence_snippet ?? '');
  const combined = `${body}\n${snippet}`;

  // Pass B literal contact
  if (phone_out) {
    if (isSequentialOrRepeatedPhone(phone_out)) {
      reasons.push('brq1_sequential_phone');
      phone_out = null;
      phone_norm = null;
    } else if (fetchStatus === 'ok' && !phoneAppearsInText(phone_out, combined)) {
      reasons.push('brq7_phone_not_literal');
      phone_out = null;
      phone_norm = null;
    } else if (fetchStatus === 'fail' && !phoneAppearsInText(phone_out, snippet)) {
      // fallback: snippet only if fetch failed
      if (!phoneAppearsInText(phone_out, snippet)) {
        reasons.push('brq7_phone_not_literal');
        phone_out = null;
        phone_norm = null;
      }
    }
  }

  if (email_out) {
    if (isDisposableOrExampleEmail(email_out)) {
      reasons.push('brq2_bad_email');
      email_out = null;
    } else {
      const domain = email_out.split('@')[1]?.toLowerCase() ?? '';
      if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
        reasons.push('brq2_gmail_hotline');
      }
      if (fetchStatus === 'ok' && !emailAppearsInText(email_out, combined)) {
        reasons.push('brq7_email_not_literal');
        email_out = null;
      } else if (fetchStatus !== 'ok' && !emailAppearsInText(email_out, snippet)) {
        reasons.push('brq7_email_not_literal');
        email_out = null;
      }
    }
  }

  if (!companyNameAppearsInText(c.company_name, combined) && !companyNameAppearsInText(c.company_name, snippet)) {
    reasons.push('brq5_company_not_in_evidence');
  }

  const evidence_ok =
    Boolean(c.evidence_url) &&
    !reasons.includes('brq4_search_url') &&
    !reasons.includes('brq9_denylist_host') &&
    (fetchStatus === 'ok' || Boolean(snippet.trim()));

  const phone_ok = Boolean(phone_out && phone_norm && phone_norm.length >= 9);
  const email_ok = Boolean(email_out && email_out.includes('@'));

  // soft geo: if province hint present, address should contain a token
  let geo_ok = Boolean(c.address && c.address.trim().length >= 8);
  const hint = opts?.expectedProvinceHint?.trim();
  if (hint && c.address) {
    const a = c.address.toLowerCase();
    const h = hint.toLowerCase();
    if (!a.includes(h) && !h.split(/\s+/).some((t) => t.length > 3 && a.includes(t))) {
      geo_ok = false;
      reasons.push('geo_hint_mismatch');
    }
  }

  const title_ok = Boolean(c.contact_title && c.contact_title.trim().length >= 2);

  const website_domain_ok =
    email_out && (c.website || c.evidence_url)
      ? emailDomainMatchesWebsite(email_out, c.website || c.evidence_url)
      : Boolean(c.website);

  if (email_out && c.website && !emailDomainMatchesWebsite(email_out, c.website)) {
    // BR-Q8 soft: personal mail ok; corporate mismatch is a reason
    const domain = email_out.split('@')[1]?.toLowerCase() ?? '';
    if (!['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
      reasons.push('brq8_email_domain_mismatch');
    }
  }

  return {
    evidence_ok,
    phone_ok,
    email_ok,
    geo_ok,
    title_ok,
    website_domain_ok,
    fetch: fetchStatus,
    reasons,
    phone_kind: phone_norm ? classifyPhone(phone_norm) : undefined,
    phone_norm,
    phone_out,
    email_out,
  };
}
