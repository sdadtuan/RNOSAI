const SEARCH_HOST_RE =
  /(^|\.)google\.(com|com\.vn)$|(^|\.)bing\.com$|(^|\.)coccoc\.com$|(^|\.)search\.yahoo\.com$/i;

const DENYLIST_HOST_RE =
  /(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)linkedin\.com$|(^|\.)instagram\.com$|(^|\.)tiktok\.com$|(^|\.)shopee\.(vn|com)$|(^|\.)lazada\.vn$/i;

export function isSearchEvidenceUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Place detail / Maps pin URLs are valid Places evidence — not Google Search SERP.
    if (
      /(^|\.)maps\.google\.(com|com\.vn)$/i.test(host) ||
      /(^|\.)google\.(com|com\.vn)$/i.test(host)
    ) {
      if (/[?&]cid=/i.test(u.search)) return false;
      if (/\/maps\/place\b/i.test(u.pathname)) return false;
      if (/\/maps\?/i.test(u.pathname + u.search) && /[?&]q=place_id:/i.test(u.search)) {
        return false;
      }
      // Actual search SERP
      if (/\/search/i.test(u.pathname) && /[?&]q=/i.test(u.search)) return true;
      if (/(^|\.)maps\.google\./i.test(host)) return false;
      return SEARCH_HOST_RE.test(host);
    }
    if (SEARCH_HOST_RE.test(host)) return true;
    if (/\/search/i.test(u.pathname) && /[?&]q=/i.test(u.search)) return true;
    return false;
  } catch {
    return true;
  }
}

export function isDenylistedEvidenceHost(url: string): boolean {
  try {
    return DENYLIST_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isSequentialOrRepeatedPhone(phone: string): boolean {
  const d = String(phone ?? '').replace(/\D+/g, '');
  if (d.length < 9) return true;
  if (/^(\d)\1+$/.test(d)) return true;
  // Only flag when the whole digit string (or without leading 0) is strictly sequential.
  if (isStrictSequential(d) || isStrictSequential(d.replace(/^0/, ''))) return true;
  return false;
}

function isStrictSequential(d: string): boolean {
  if (d.length < 8) return false;
  let asc = true;
  let desc = true;
  for (let i = 1; i < d.length; i += 1) {
    const a = Number(d[i - 1]);
    const b = Number(d[i]);
    if (b !== (a + 1) % 10) asc = false;
    if (b !== (a + 9) % 10) desc = false;
  }
  return asc || desc;
}

export function isDisposableOrExampleEmail(email: string): boolean {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e.includes('@')) return true;
  const domain = e.split('@')[1] ?? '';
  return (
    domain === 'example.com' ||
    domain === 'test.com' ||
    domain === 'example.vn' ||
    domain.endsWith('.example') ||
    domain === 'mailinator.com' ||
    domain === 'tempmail.com'
  );
}

export function isGenericCompanyName(name: string): boolean {
  const n = String(name ?? '').trim().toLowerCase();
  if (n.length < 4) return true;
  const generics = [
    /^công ty( tnhh| cổ phần)?\s+(abc|xyz|a b c)$/i,
    /^spa hà nội$/i,
    /^spa sài gòn$/i,
    /^company\s+\d+$/i,
  ];
  return generics.some((re) => re.test(n));
}

export function emailDomainMatchesWebsite(
  email: string | null,
  websiteOrEvidence: string | null,
): boolean {
  if (!email || !websiteOrEvidence) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) return false;
  try {
    const host = new URL(
      /^https?:\/\//i.test(websiteOrEvidence) ? websiteOrEvidence : `https://${websiteOrEvidence}`,
    ).hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
  } catch {
    return false;
  }
}
