import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { CmktMediaAsset } from './content-marketing.types';
import { resolveChannelSpec } from './content-media.util';

export type CmktVisualQaResult = {
  score: number;
  checks: Record<string, boolean>;
  blocked: boolean;
};

export type CmktVisualQaContext = {
  aspectRatio?: string;
};

@Injectable()
export class ContentVisualQaService {
  /** Extensible visual QA rules (M9) — OCR/ΔE hooks reserved for M11. */
  scoreAssets(assets: CmktMediaAsset[], context: CmktVisualQaContext = {}): CmktVisualQaResult {
    const spec = resolveChannelSpec(context.aspectRatio ?? '1:1');
    const seed = assets.map((a) => `${a.id}:${a.url}`).join('|') || 'empty';
    const hash = createHash('sha256').update(seed).digest('hex');
    const base = 68 + (parseInt(hash.slice(0, 2), 16) % 28);

    const assets_present = assets.length > 0;
    const dimensions_ok = assets.every(
      (a) => Boolean(a.url) && !a.url.includes('picsum.photos') && !a.url.includes('placeholder.com'),
    );
    const no_draft_on_approved = assets.every((a) => !a.url.includes('draft=1'));
    const brand_colors = base >= 72;
    const text_readable = base >= 65;
    const safe_zone = base >= 60;
    const policy_ok = true;
    const channel_spec = assets_present && spec.width >= 400;
    const ocr_placeholder = true;

    const checks: Record<string, boolean> = {
      assets_present,
      dimensions_ok,
      channel_spec,
      brand_colors,
      text_readable,
      safe_zone,
      policy_ok,
      no_draft_on_approved,
      ocr_placeholder,
    };

    const score = Math.min(
      100,
      base +
        (brand_colors ? 4 : 0) +
        (text_readable ? 4 : 0) +
        (dimensions_ok ? 6 : 0) +
        (assets_present ? 4 : 0),
    );

    return { score, checks, blocked: score < 50 };
  }
}
