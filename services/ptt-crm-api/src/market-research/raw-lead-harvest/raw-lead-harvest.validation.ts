import type { CreateRawLeadHarvestBody, RawLeadHarvestMode } from './raw-lead-harvest.types';

export type HarvestValidationError = { error: string; detail?: string };

export function normalizeHarvestMode(raw: unknown): RawLeadHarvestMode {
  return raw === 'volume' ? 'volume' : 'quality';
}

export function validateCreateRawLeadHarvest(
  body: CreateRawLeadHarvestBody,
): HarvestValidationError | null {
  if (!String(body.industry_key ?? '').trim()) return { error: 'industry_key_required' };
  // job_title_key / province_code / ward_code are optional ("Tất cả")
  if (!String(body.provider ?? '').trim()) return { error: 'provider_required' };
  if (!String(body.model ?? '').trim()) return { error: 'model_required' };

  const sources = Array.isArray(body.source_keys) ? body.source_keys.filter(Boolean) : [];
  if (sources.length < 1) return { error: 'source_keys_required' };

  const mode = normalizeHarvestMode(body.mode);
  const count = Number(body.target_count);
  if (!Number.isFinite(count) || count < 5) return { error: 'target_count_min_5' };
  if (mode === 'quality' && count > 25) return { error: 'target_count_quality_max_25' };
  if (mode === 'volume' && count > 50) return { error: 'target_count_volume_max_50' };

  return null;
}
