import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import { ContentMarketingService } from '../content-marketing/content-marketing.service';
import type { CmktMediaJson } from '../content-marketing/content-marketing.types';
import {
  ASSET_RIGHT_STATUSES,
  type AssetRightStatus,
  type CmktAssetRightRow,
  type CmktAssetRightWrite,
} from './content-os-portfolio.types';

export type AssetRightEvalRow = {
  asset_ref: string;
  status: string;
  paid_ok?: boolean;
};

export function selectedMediaAssetRefs(media: CmktMediaJson | undefined): string[] {
  if (!media) return [];
  const refs = new Set<string>();
  const assets = [
    ...(media.ai_assets ?? []),
    ...(media.carousel_slides ?? []),
    ...(media.video_short ? [media.video_short] : []),
    ...Object.values(media.video_packs ?? {}),
  ];
  const selectedId = media.selected_asset_id;
  for (const asset of assets) {
    const url = String(asset?.url ?? '').trim();
    if (!url) continue;
    if (asset.selected === true || (selectedId && asset.id === selectedId)) {
      refs.add(url);
    }
  }
  return [...refs];
}

export function evaluateItemRights(
  media: CmktMediaJson | undefined,
  rows: AssetRightEvalRow[],
): { rightsValid?: boolean; paidExpiryWarning?: boolean } {
  const byRef = new Map<string, AssetRightEvalRow>();
  for (const row of rows) {
    const ref = String(row.asset_ref ?? '').trim();
    if (ref) byRef.set(ref, row);
  }
  const required = new Set<string>([...selectedMediaAssetRefs(media), ...byRef.keys()]);
  if (!required.size) return {};

  let rightsValid = true;
  let paidExpiryWarning = false;
  for (const ref of required) {
    const row = byRef.get(ref);
    const status = row?.status ?? 'Unknown';
    if (status === 'Unknown' || status === 'Invalid') rightsValid = false;
    if (status === 'Expiring' && row?.paid_ok) paidExpiryWarning = true;
  }
  return paidExpiryWarning ? { rightsValid, paidExpiryWarning } : { rightsValid };
}

function isAssetRightStatus(value: string): value is AssetRightStatus {
  return (ASSET_RIGHT_STATUSES as readonly string[]).includes(value);
}

function parseRightsWrites(body: Record<string, unknown>): CmktAssetRightWrite[] {
  const raw = Array.isArray(body) ? body : body.rights;
  if (!Array.isArray(raw)) {
    throw new BadRequestException({ error: 'rights_required' });
  }
  return raw.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const assetRef = String(row.asset_ref ?? '').trim();
    if (!assetRef) {
      throw new BadRequestException({ error: 'asset_ref_required' });
    }
    const statusRaw = row.status != null ? String(row.status).trim() : 'Unknown';
    if (!isAssetRightStatus(statusRaw)) {
      throw new BadRequestException({ error: 'invalid_rights_status', status: statusRaw });
    }
    const channels = Array.isArray(row.channels)
      ? row.channels.map((ch) => String(ch).trim()).filter(Boolean)
      : [];
    return {
      asset_ref: assetRef,
      license_type: row.license_type != null ? String(row.license_type).trim() || null : null,
      channels,
      territory: row.territory != null ? String(row.territory).trim() || null : null,
      expiry_at: row.expiry_at != null ? String(row.expiry_at).trim() || null : null,
      paid_ok: Boolean(row.paid_ok),
      releases_ok: Boolean(row.releases_ok),
      ai_declaration: Boolean(row.ai_declaration),
      status: statusRaw,
    };
  });
}

@Injectable()
export class AssetRightsService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listRights(lifecycleId: number, itemId: number): Promise<{ rights: CmktAssetRightRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    const rights = await this.repo.listAssetRights(itemId);
    return { rights };
  }

  async replaceRights(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
  ): Promise<{ rights: CmktAssetRightRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    const rights = await this.repo.replaceAssetRights(itemId, parseRightsWrites(body));
    return { rights };
  }

  async overrideRight(
    lifecycleId: number,
    itemId: number,
    rightsId: number,
    body: Record<string, unknown>,
    actorEmail = 'unknown',
  ): Promise<CmktAssetRightRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 10) {
      throw new BadRequestException({
        error: 'override_reason_required',
        message: 'Override reason tối thiểu 10 ký tự.',
        min_length: 10,
      });
    }
    const evidence = String(body.evidence ?? '').trim();
    if (!evidence) {
      throw new BadRequestException({
        error: 'override_evidence_required',
        message: 'Override evidence không được trống.',
      });
    }
    const existing = await this.repo.getAssetRightById(rightsId);
    if (!existing || existing.item_id !== itemId) {
      throw new NotFoundException({ error: 'rights_not_found', id: rightsId });
    }
    const updated = await this.repo.updateAssetRightStatus(rightsId, 'Valid');
    await this.repo.insertItemVersion(itemId, item.body_json, actorEmail, 'rights_override');
    return updated ?? { ...existing, status: 'Valid' };
  }
}
