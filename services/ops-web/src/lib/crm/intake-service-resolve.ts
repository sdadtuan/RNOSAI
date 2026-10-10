export const CATALOG_SERVICE_SLUGS = [
  'dich-vu-seo-tong-the',
  'dich-vu-aeo',
  'dich-vu-seo-local',
  'dich-vu-seo-audit',
  'dich-vu-quan-tri-website',
  'thiet-ke-website',
  'thiet-ke-website-tron-goi',
  'thiet-ke-landing-page',
  'quang-cao-facebook',
  'quang-cao-google',
  'thue-tai-khoan-quang-cao',
  'tiep-thi-noi-dung',
] as const;

export const PILOT_SERVICE_SLUGS = [
  'dich-vu-seo-tong-the',
  'quang-cao-google',
  'thiet-ke-website',
] as const;

const LABELS: Record<string, string> = {
  'dich-vu-seo-tong-the': 'SEO tổng thể',
  'dich-vu-aeo': 'AEO',
  'quang-cao-google': 'Quảng cáo Google',
  'thiet-ke-website': 'Thiết kế website',
  _common: 'Chưa chọn dịch vụ',
};

const KNOWN = new Set<string>([...CATALOG_SERVICE_SLUGS, '_common']);

export function normalizeIntakeSlug(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s === '00-form-chung' || s === 'common' || s === 'form-chung') return '_common';
  return s;
}

function acceptedSlug(slug: string, catalogSlugs?: readonly string[]): boolean {
  if (!slug || slug === '_common') return false;
  if (KNOWN.has(slug)) return true;
  return (catalogSlugs ?? []).includes(slug);
}

export function resolveIntakeServiceSlug(input: {
  urlSlug?: string | null;
  sessionSlug?: string | null;
  funnelSlug?: string | null;
  catalogSlugs?: readonly string[];
}): string {
  const url = normalizeIntakeSlug(input.urlSlug);
  if (acceptedSlug(url, input.catalogSlugs)) return url;
  if (url === '_common') {
    /* fall through — URL common does not beat session/funnel */
  }
  const session = normalizeIntakeSlug(input.sessionSlug);
  if (acceptedSlug(session, input.catalogSlugs)) return session;
  const funnel = normalizeIntakeSlug(input.funnelSlug);
  if (acceptedSlug(funnel, input.catalogSlugs) || (funnel && KNOWN.has(funnel))) return funnel;
  if (url === '_common') return '_common';
  return '_common';
}

export function intakeServiceLabel(slug: string, catalogName?: string): string {
  const n = normalizeIntakeSlug(slug) || '_common';
  if (catalogName?.trim()) return catalogName.trim();
  return LABELS[n] ?? n;
}

export function gapToGo(bantTotal: number, goThreshold = 24): number {
  const t = Number(bantTotal) || 0;
  return Math.max(0, goThreshold - t);
}

export function gapToConsultLabel(gap: number): string {
  const n = Number(gap) || 0;
  return n <= 0 ? 'Đủ điểm BANT' : `Còn ${n} để đủ điểm BANT`;
}

export function isPilotServiceSlug(slug: string): boolean {
  return (PILOT_SERVICE_SLUGS as readonly string[]).includes(normalizeIntakeSlug(slug));
}

export function shouldSyncDraftServiceSlug(input: {
  status?: string | null;
  sessionSlug?: string | null;
  resolvedSlug: string;
  catalogSlugs?: readonly string[];
}): boolean {
  if (String(input.status ?? '').trim() !== 'draft') return false;
  const resolved = normalizeIntakeSlug(input.resolvedSlug);
  if (!acceptedSlug(resolved, input.catalogSlugs)) return false;
  return normalizeIntakeSlug(input.sessionSlug) !== resolved;
}
