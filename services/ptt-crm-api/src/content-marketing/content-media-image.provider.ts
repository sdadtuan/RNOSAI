import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import type { CmktMediaAsset } from './content-marketing.types';
import { hashMediaPrompt, resolveChannelSpec } from './content-media.util';

export type CmktImageGenerateInput = {
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
  constructor(private readonly config: AppConfigService) {}

  get providerName(): string {
    return (process.env.PTT_CMKT_IMAGE_PROVIDER ?? 'stub').trim() || 'stub';
  }

  async generateImages(input: CmktImageGenerateInput): Promise<CmktMediaAsset[]> {
    const spec = resolveChannelSpec(input.aspectRatio);
    const promptHash = hashMediaPrompt([
      input.title,
      input.approvedCopy.slice(0, 500),
      input.stylePreset,
      input.aspectRatio,
      String(input.variantCount),
    ]);
    const texts =
      input.assetType === 'carousel_slide' && input.slideTexts?.length
        ? input.slideTexts
        : Array.from({ length: input.variantCount }, (_, i) => `${input.title} — variant ${i + 1}`);

    const approved = !input.draftWatermark;
    return texts.map((label, idx) => {
      const seed = hashMediaPrompt([promptHash, label, String(idx)]);
      const url = `https://picsum.photos/seed/cmkt-${seed}/${spec.width}/${spec.height}`;
      return {
        id: randomUUID(),
        type: input.assetType ?? 'image',
        url: approved ? url : `${url}?draft=1`,
        ai_generated: true,
        provider: this.providerName,
        selected: idx === 0,
        draft_watermark: !approved,
        slide_index: input.assetType === 'carousel_slide' ? idx + 1 : undefined,
        prompt_hash: promptHash,
        visual_qa_score: 72 + (idx % 3) * 5,
      };
    });
  }
}
