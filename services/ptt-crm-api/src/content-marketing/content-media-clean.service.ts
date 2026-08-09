import { Injectable } from '@nestjs/common';
import { ContentMediaAssetCacheService } from './content-media-asset-cache.service';
import { ContentMediaStorageService } from './content-media-storage.service';
import type { CmktMediaAsset, CmktMediaJson } from './content-marketing.types';

@Injectable()
export class ContentMediaCleanService {
  constructor(
    private readonly storage: ContentMediaStorageService,
    private readonly cache: ContentMediaAssetCacheService,
  ) {}

  promoteAsset(asset: CmktMediaAsset, lifecycleId: number, itemId: number): CmktMediaAsset {
    if (!asset.draft_watermark && !asset.clean_storage_key) return asset;

    const cleanKey = asset.clean_storage_key;
    const cleanUrl = cleanKey ? this.storage.buildPublicUrl(cleanKey) : asset.url.replace(/\?draft=1/, '');

    this.cache.deleteCleanBuffer(lifecycleId, itemId, asset.id);

    return {
      ...asset,
      url: cleanUrl,
      draft_watermark: false,
      storage_key: cleanKey ?? asset.storage_key,
    };
  }

  promoteMediaJson(media: CmktMediaJson, lifecycleId: number, itemId: number): CmktMediaJson {
    const promoteList = (assets?: CmktMediaAsset[]) =>
      assets?.map((a) => this.promoteAsset(a, lifecycleId, itemId));

    const next: CmktMediaJson = { ...media };
    if (media.ai_assets?.length) next.ai_assets = promoteList(media.ai_assets);
    if (media.carousel_slides?.length) next.carousel_slides = promoteList(media.carousel_slides);
    if (media.video_short) next.video_short = this.promoteAsset(media.video_short, lifecycleId, itemId);

    const selectedId = next.selected_asset_id;
    if (selectedId) {
      const selected = [...(next.ai_assets ?? []), ...(next.carousel_slides ?? [])].find(
        (a) => a.id === selectedId,
      );
      if (selected) next.selected_asset_id = selected.id;
    }
    return next;
  }
}
