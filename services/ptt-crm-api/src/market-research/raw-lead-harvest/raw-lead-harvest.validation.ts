import type { CreateRawLeadHarvestBody, RawLeadHarvestMode } from './raw-lead-harvest.types';

export type HarvestValidationError = { error: string; detail?: string };

export function normalizeHarvestMode(raw: unknown): RawLeadHarvestMode {
  if (raw === 'volume') return 'volume';
  if (raw === 'marketing') return 'marketing';
  if (raw === 'intent') return 'intent';
  return 'quality';
}

export function validateCreateRawLeadHarvest(
  body: CreateRawLeadHarvestBody,
): HarvestValidationError | null {
  if (!String(body.industry_key ?? '').trim()) return { error: 'industry_key_required' };

  const mode = normalizeHarvestMode(body.mode);

  if (mode === 'intent') {
    const province = String(body.province_code ?? '').trim();
    if (!province || province === 'all') {
      return { error: 'intent_province_required' };
    }
  } else {
    if (!String(body.provider ?? '').trim()) return { error: 'provider_required' };
    if (!String(body.model ?? '').trim()) return { error: 'model_required' };
  }

  const sources = Array.isArray(body.source_keys) ? body.source_keys.filter(Boolean) : [];
  if (sources.length < 1) return { error: 'source_keys_required' };

  const count = Number(body.target_count);
  // Positive integer only — no Quality 5–25 / Volume 5–50 caps.
  if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
    return { error: 'target_count_invalid' };
  }

  return null;
}
