/** Places query grid for HCM (province 79) — pre-merge district names still match Maps. */
export const HCM_MARKET_GRID = [
  'Quận 1',
  'Quận 3',
  'Quận 5',
  'Quận 7',
  'Quận 10',
  'Quận 11',
  'Tân Bình',
  'Phú Nhuận',
  'Bình Thạnh',
  'Gò Vấp',
  'Tân Phú',
  'Thủ Đức',
  'Bình Tân',
  'Nhà Bè',
  'Hóc Môn',
  'Củ Chi',
] as const;

export function isHcmProvince(provinceCode: string, provinceName: string): boolean {
  if (String(provinceCode).trim() === '79') return true;
  return /h[oồ]\s*ch[ií]\s*minh|tp\.?\s*hcm|\bhcm\b/i.test(String(provinceName));
}

/** Build Text Search queries for market_graph crawl. */
export function buildMarketGraphQueries(input: {
  industry_label: string;
  province_code: string;
  province_name: string;
  ward_name?: string | null;
}): string[] {
  const industry = String(input.industry_label ?? '').trim();
  const province = String(input.province_name ?? '').trim();
  const ward = String(input.ward_name ?? '').trim();
  if (!industry) return [];
  if (ward) return [`${industry} ${ward} ${province}`.trim()];
  if (isHcmProvince(input.province_code, input.province_name)) {
    return HCM_MARKET_GRID.map((d) => `${industry} ${d} ${province}`.trim());
  }
  return [`${industry} ${province}`.trim()].filter(Boolean);
}
