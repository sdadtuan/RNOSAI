import type { CpAssetRightsInput } from './cp-api';

export type CpRightsDraft = {
  license_type: string;
  owner_name: string;
  effective_on: string;
  expiry_on: string;
  territory: string;
  channels: string;
  restriction: string;
  proof_asset_id: string;
  model_release: boolean;
  talent_release: boolean;
  model_release_touched: boolean;
  talent_release_touched: boolean;
};

type CurrentRights = CpAssetRightsInput;

export function parseCpFinalizeInput(
  finalize: boolean,
  rawBytes: string,
  rawHash: string,
): { bytes: number; hash: string } | null {
  if (!finalize) return null;
  const bytesText = rawBytes.trim();
  if (!bytesText) throw new Error('bytes_required');
  const bytes = Number(bytesText);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid_bytes');
  const hash = rawHash.trim();
  if (!hash) throw new Error('hash_required');
  return { bytes, hash };
}

export function buildCpRightsInput(
  current: CurrentRights,
  draft: CpRightsDraft,
): CpAssetRightsInput {
  const input: CpAssetRightsInput = {};
  const textFields = [
    'license_type',
    'owner_name',
    'effective_on',
    'expiry_on',
    'restriction',
    'proof_asset_id',
  ] as const;

  for (const field of textFields) {
    const value = draft[field].trim();
    if (value || current[field] != null) input[field] = value || null;
  }

  const territory = commaList(draft.territory);
  if (territory.length || current.territory?.length) input.territory = territory;
  const channels = commaList(draft.channels);
  if (channels.length || current.channels?.length) input.channels = channels;

  if (current.model_release != null || draft.model_release_touched) {
    input.model_release = draft.model_release;
  }
  if (current.talent_release != null || draft.talent_release_touched) {
    input.talent_release = draft.talent_release;
  }
  return input;
}

function commaList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}
