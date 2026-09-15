function normalizeName(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** National chains / marketplaces — low AM value for outbound marketing. */
export const DEFAULT_CHAIN_DENYLIST: string[] = [
  'hasaki',
  'kangnam',
  'gangwhoo',
  'seoulspa',
  'seoul spa',
  'ngoc dung',
  'thu cuc',
  'diva',
  'benh vien tham my dong a',
  'dong a',
  'pensilia',
  'o2 skin',
  'o2skin',
  'sen spa',
];

export function isChainDenylistName(name: string, extra: string[] = []): boolean {
  const n = normalizeName(name);
  if (!n) return false;
  const list = [...DEFAULT_CHAIN_DENYLIST, ...extra.map(normalizeName)].filter(Boolean);
  return list.some((token) => token.length >= 3 && n.includes(token));
}

export type IntentScoreInput = {
  company_name: string;
  has_places_phone: boolean;
  has_website: boolean;
  website_fetch_ok: boolean;
  scraped_contact: boolean;
  ratings_total?: number | null;
  extra_denylist?: string[];
};

/**
 * Intent score 0–100 (design §7). Threshold default 40 to enter scrape/persist path.
 */
export function computeIntentScore(input: IntentScoreInput): number {
  let score = 0;
  if (input.has_places_phone) score += 25;
  if (!input.has_website || !input.website_fetch_ok) score += 20;
  if (input.has_website && input.website_fetch_ok && !input.scraped_contact) score += 15;
  const ratings = input.ratings_total;
  if (ratings == null || ratings < 20) score += 10;
  // types match industry — caller may pre-boost; base +10 when not denylist
  if (!isChainDenylistName(input.company_name, input.extra_denylist)) score += 10;
  if (isChainDenylistName(input.company_name, input.extra_denylist)) score -= 40;
  return Math.max(0, Math.min(100, score));
}
