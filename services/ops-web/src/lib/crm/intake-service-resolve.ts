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

export function resolveIntakeServiceSlug(input: {
  urlSlug?: string | null;
  sessionSlug?: string | null;
  funnelSlug?: string | null;
}): string {
  const url = normalizeIntakeSlug(input.urlSlug);
  if (url && KNOWN.has(url) && url !== '_common') return url;
  if (url === '_common') {
    /* fall through — URL common does not beat session/funnel */
  }
  const session = normalizeIntakeSlug(input.sessionSlug);
  if (session && KNOWN.has(session) && session !== '_common') return session;
  const funnel = normalizeIntakeSlug(input.funnelSlug);
  if (funnel && KNOWN.has(funnel)) return funnel;
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

export function isPilotServiceSlug(slug: string): boolean {
  return (PILOT_SERVICE_SLUGS as readonly string[]).includes(normalizeIntakeSlug(slug));
}

export function shouldSyncDraftServiceSlug(input: {
  status?: string | null;
  sessionSlug?: string | null;
  resolvedSlug: string;
}): boolean {
  if (String(input.status ?? '').trim() !== 'draft') return false;
  const resolved = normalizeIntakeSlug(input.resolvedSlug);
  if (!resolved || resolved === '_common' || !KNOWN.has(resolved)) return false;
  return normalizeIntakeSlug(input.sessionSlug) !== resolved;
}
