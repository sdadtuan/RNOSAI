const TEXT_LIMIT = 12_000;
const RAW_HTML_LIMIT = 500_000;
const IMAGE_LIMIT = 8;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

export type ClientPlanFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientPlanSourceResult {
  text: string;
  image_urls: string[];
  fetched_urls: string[];
  errors: string[];
}

export async function fetchClientPlanSources(
  urls: string[],
  fetchImpl: ClientPlanFetch,
): Promise<ClientPlanSourceResult> {
  const textParts: string[] = [];
  const imageUrls: string[] = [];
  const fetchedUrls: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const raw of urls) {
    const start = String(raw ?? '').trim();
    if (!start || seen.has(start)) continue;
    seen.add(start);
    const page = await readPublicPage(start, fetchImpl);
    if ('error' in page) {
      errors.push(page.error);
      continue;
    }
    fetchedUrls.push(page.finalUrl);
    textParts.push(htmlToText(page.html));
    collectImages(page.html, page.finalUrl, imageUrls);
  }

  return {
    text: textParts.filter(Boolean).join('\n').slice(0, TEXT_LIMIT),
    image_urls: imageUrls.slice(0, IMAGE_LIMIT),
    fetched_urls: fetchedUrls,
    errors,
  };
}

async function readPublicPage(
  start: string,
  fetchImpl: ClientPlanFetch,
): Promise<{ html: string; finalUrl: string } | { error: string }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = parsePublicHttpUrl(current);
    if (!parsed.ok) return { error: parsed.error };
    let res: Response;
    try {
      res = await fetchImpl(parsed.url.href, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'RNOSAI-CRM-ClientPlan/1.0',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'fetch_failed';
      return { error: `${parsed.url.href}: ${message}` };
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return { error: `${parsed.url.href}: redirect thiếu Location` };
      current = new URL(location, parsed.url).href;
      continue;
    }
    if (!res.ok) return { error: `${parsed.url.href}: http_${res.status}` };
    const html = (await res.text()).slice(0, RAW_HTML_LIMIT);
    return { html, finalUrl: parsed.url.href };
  }
  return { error: `${start}: quá nhiều redirect` };
}

function parsePublicHttpUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: `URL không hợp lệ: ${raw}` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: `Chỉ nhận http/https: ${raw}` };
  }
  if (url.username || url.password) {
    return { ok: false, error: `URL có thông tin đăng nhập: ${raw}` };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: `Chặn host nội bộ: ${raw}` };
  }
  return { ok: true, url };
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1' ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }
  if (host.startsWith('::ffff:')) return isBlockedHost(host.slice('::ffff:'.length));
  if (host.includes(':')) {
    const head = host.split(':').find(Boolean) ?? '';
    return head === 'fe80' || head.startsWith('fc') || head.startsWith('fd');
  }
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => n > 255)) return false;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function collectImages(html: string, pageUrl: string, into: string[]): void {
  const tags = html.match(/<(?:meta|img)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (into.length >= IMAGE_LIMIT) return;
    const isOg = /^<meta\b/i.test(tag) && /\b(?:property|name)\s*=\s*["']og:image["']/i.test(tag);
    const isImg = /^<img\b/i.test(tag);
    if (!isOg && !isImg) continue;
    const raw = isOg
      ? /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
      : /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (raw) pushImage(into, decodeHtml(raw), pageUrl);
  }
}

function pushImage(into: string[], raw: string, pageUrl: string): void {
  if (into.length >= IMAGE_LIMIT) return;
  let abs: URL;
  try {
    abs = new URL(raw.trim(), pageUrl);
  } catch {
    return;
  }
  if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
  if (isBlockedHost(abs.hostname)) return;
  if (into.includes(abs.href)) return;
  into.push(abs.href);
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}
