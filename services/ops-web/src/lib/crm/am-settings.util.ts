export type AmSettingsWeights = {
  kpi_delivery: number;
  engagement: number;
  financial: number;
  satisfaction: number;
  contract_support: number;
};

export type AmSettingsBands = {
  healthy: [number, number];
  watch: [number, number];
  at_risk: [number, number];
  critical: [number, number];
};

const WEIGHT_KEYS: Array<keyof AmSettingsWeights> = [
  'kpi_delivery',
  'engagement',
  'financial',
  'satisfaction',
  'contract_support',
];

const BAND_KEYS: Array<keyof AmSettingsBands> = ['healthy', 'watch', 'at_risk', 'critical'];

export function amSettingsWeightsError(weights: AmSettingsWeights): 'weights_sum' | null {
  let sum = 0;
  for (const key of WEIGHT_KEYS) {
    const n = Number(weights[key]);
    if (!Number.isFinite(n) || n < 0) return 'weights_sum';
    sum += n;
  }
  return sum === 100 ? null : 'weights_sum';
}

export function amSettingsBandsError(bands: AmSettingsBands): 'bands_overlap' | null {
  const ranges: Array<[number, number]> = [];
  for (const key of BAND_KEYS) {
    const pair = bands[key];
    if (!Array.isArray(pair) || pair.length < 2) return 'bands_overlap';
    const lo = Number(pair[0]);
    const hi = Number(pair[1]);
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo > hi) return 'bands_overlap';
    ranges.push([lo, hi]);
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (ranges[0][0] !== 0 || ranges[ranges.length - 1][1] !== 100) return 'bands_overlap';
  for (let i = 1; i < ranges.length; i += 1) {
    if (ranges[i][0] !== ranges[i - 1][1] + 1) return 'bands_overlap';
  }
  return null;
}

export function amSettingsPublishErrorCopy(code: string): string {
  if (code === 'weights_sum') return 'weights_sum — tổng trọng số phải bằng 100.';
  if (code === 'bands_overlap') return 'bands_overlap — ngưỡng không được chồng và phải liền 0–100.';
  return code;
}

export const AM_FIELD_TYPES = ['text', 'number', 'date', 'bool', 'select'] as const;
export type AmFieldType = (typeof AM_FIELD_TYPES)[number];

const AM_API_KEY_RE = /^[a-z][a-z0-9_]*$/;

export function amApiKeyError(apiKey: string): 'api_key_invalid' | null {
  return AM_API_KEY_RE.test(String(apiKey ?? '').trim()) ? null : 'api_key_invalid';
}

export const AM_BDS_FIELD_TEMPLATES: Array<{
  api_key: string;
  label: string;
  field_type: AmFieldType;
  industry_slug: string;
}> = [
  { api_key: 'project_name', label: 'Dự án chính', field_type: 'text', industry_slug: 'bds' },
  { api_key: 'leads_per_month', label: 'Mục tiêu lead/tháng', field_type: 'number', industry_slug: 'bds' },
];

export const AM_SLA_DEFAULTS = {
  workday_start: '08:30',
  workday_end: '17:30',
  workdays: [1, 2, 3, 4, 5],
  pause_on_waiting_client: true,
  escalate_json: { '70': 'lead', '90': 'director', '100': 'executive' } as Record<string, string>,
};

export function amParseHolidays(raw: string): string[] {
  const dates = String(raw ?? '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  return [...new Set(dates)].sort();
}

export function amHolidayText(holidays: string[]): string {
  return holidays.join('\n');
}

export function amParseAccessJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function amEscalateFromInputs(lead: string, director: string, executive: string) {
  return {
    '70': lead.trim() || 'lead',
    '90': director.trim() || 'director',
    '100': executive.trim() || 'executive',
  };
}
