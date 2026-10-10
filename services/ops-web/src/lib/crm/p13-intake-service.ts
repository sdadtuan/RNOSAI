const SLUG_TO_P13: Record<string, string> = {
  'dich-vu-seo-tong-the': 'SEO',
  'dich-vu-aeo': 'SEO',
  'dich-vu-seo-local': 'SEO',
  'dich-vu-seo-audit': 'SEO',
  'dich-vu-quan-tri-website': 'WEB',
  'thiet-ke-website': 'WEB',
  'thiet-ke-website-tron-goi': 'WEB',
  'thiet-ke-landing-page': 'WEB',
  'quang-cao-facebook': 'ADS',
  'quang-cao-google': 'ADS',
  'thue-tai-khoan-quang-cao': 'ADS',
  'tiep-thi-noi-dung': 'CS',
};

export function p13CodeForIntakeService(
  input: { slug: string; label?: string | null },
  services: Array<{ code: string; name?: string }>,
): string | null {
  const bySlug = p13CodeForIntakeSlug(input.slug, services);
  if (bySlug) return bySlug;
  const label = String(input.label ?? '').trim().toLowerCase();
  if (!label) return null;
  const hit = services.find((row) => String(row.name ?? '').trim().toLowerCase() === label);
  return hit ? hit.code.toUpperCase() : null;
}

export function p13CodeForIntakeSlug(
  slug: string,
  services: Array<{ code: string }>,
): string | null {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || normalized === '_common') return null;
  const mapped = SLUG_TO_P13[normalized];
  if (mapped && services.some((row) => row.code.toUpperCase() === mapped)) return mapped;
  const direct = services.find((row) => row.code.toLowerCase() === normalized);
  return direct ? direct.code.toUpperCase() : null;
}
