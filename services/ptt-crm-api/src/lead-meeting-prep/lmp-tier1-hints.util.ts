/** Phase 0 — tier-1 hints before Tavily Discover (email domain, form fields). */

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.com.vn',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'ymail.com',
  'mail.ru',
  'zoho.com',
]);

export type LmpTier1Hints = {
  company_name?: string;
  website_url?: string;
};

function titleWords(raw: string): string {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function companyHintFromEmailDomain(email: string): LmpTier1Hints {
  const at = email.indexOf('@');
  if (at < 0) return {};
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return {};

  const label = domain.split('.')[0] ?? '';
  if (label.length < 2) return {};

  return {
    website_url: `https://${domain}`,
    company_name: titleWords(label),
  };
}

export function normalizeWebsiteUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/\//, '')}`;
}
