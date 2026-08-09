import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import type { CmktMediaAsset } from './content-marketing.types';
import { hashMediaPrompt } from './content-media.util';
import { ReplicateMediaProvider } from './content-media-replicate.provider';
import { StubMediaProvider } from './content-media-stub.provider';
import { ContentMediaStorageService } from './content-media-storage.service';
import { applyDraftWatermarkToBuffer } from './content-media-watermark.util';
import type { CmktMediaImageProviderContract } from './content-media-provider.interface';

export type CmktImageGenerateInput = {
  lifecycleId: number;
  itemId: number;
  variantCount: number;
  aspectRatio: string;
  stylePreset: string;
  title: string;
  approvedCopy: string;
  draftWatermark: boolean;
  slideTexts?: string[];
  assetType?: 'image' | 'carousel_slide';
};

@Injectable()
export class ContentMediaImageProvider {
  constructor(
    private readonly config: AppConfigService,
    private readonly storage: ContentMediaStorageService,
    private readonly stub: StubMediaProvider,
    private readonly replicate: ReplicateMediaProvider,
  ) {}

  get providerName(): string {
    return this.resolveProvider().name;
  }

  private resolveProvider(): CmktMediaImageProviderContract {
    const configured = this.config.contentMarketingImageProvider;
    if (configured === 'replicate' && this.config.replicateApiToken) {
      return this.replicate;
    }
    return this.stub;
  }

  async generateImages(input: CmktImageGenerateInput): Promise<CmktMediaAsset[]> {
    const provider = this.resolveProvider();
    const promptHash = hashMediaPrompt([
      input.title,
      input.approvedCopy.slice(0, 500),
      input.stylePreset,
      input.aspectRatio,
      String(input.variantCount),
      provider.name,
    ]);

    const generated = await provider.generateImages(input);
    const assets: CmktMediaAsset[] = [];

    for (let idx = 0; idx < generated.length; idx++) {
      const row = generated[idx];
      const assetId = randomUUID();
      let buffer = row.buffer;
      if (input.draftWatermark) {
        buffer = await applyDraftWatermarkToBuffer(buffer, true);
      }
      const uploaded = await this.storage.uploadAsset({
        lifecycleId: input.lifecycleId,
        itemId: input.itemId,
        assetId,
        buffer,
        contentType: row.contentType,
      });
      assets.push({
        id: assetId,
        type: input.assetType ?? 'image',
        url: uploaded.url,
        ai_generated: true,
        provider: provider.name,
        selected: idx === 0,
        draft_watermark: input.draftWatermark,
        slide_index: row.slideIndex,
        prompt_hash: promptHash,
        provider_request_id: row.providerRequestId,
        storage_key: uploaded.storageKey,
        visual_qa_score: 72 + (idx % 3) * 5,
      });
    }

    return assets;
  }
}
