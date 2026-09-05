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
