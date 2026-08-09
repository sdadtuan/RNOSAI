import {
  deltaE76,
  extractBrandPalette,
  hexToRgb,
  minDeltaEToPalette,
  rgbToLab,
  scoreFromImageAnalysis,
} from './content-visual-qa.util';
import { extractClipKeywords } from './content-media-stock.provider';
import { ContentMediaCleanService } from './content-media-clean.service';
import { ContentMediaStorageService } from './content-media-storage.service';
import type { CmktMediaAsset } from './content-marketing.types';

describe('content-visual-qa.util', () => {
  it('computes deltaE between similar colors', () => {
    const a = rgbToLab(30, 58, 95);
    const b = rgbToLab(32, 60, 98);
    expect(deltaE76(a, b)).toBeLessThan(5);
  });

  it('extracts palette from brand context', () => {
    const palette = extractBrandPalette({
      palette_colors: ['#1e3a5f', '#ffffff'],
      _source: 'snapshot',
    });
    expect(palette.colors).toEqual(['#1e3a5f', '#ffffff']);
  });

  it('scores image analysis with OCR and brand checks', () => {
    const scored = scoreFromImageAnalysis(
      {
        brand_delta_e_max: 8,
        brand_delta_e_avg: 8,
        ocr_confidence: 0.82,
        contrast_ratio: 5.2,
        dominant_hex: '#1e3a5f',
      },
      {
        assets_present: true,
        dimensions_ok: true,
        channel_spec: true,
        policy_ok: true,
        safe_zone: true,
        no_draft_on_approved: false,
        brand_colors: true,
        text_readable: true,
      },
    );
    expect(scored.checks.brand_delta_e_ok).toBe(true);
    expect(scored.checks.ocr_confidence_ok).toBe(true);
    expect(scored.score).toBeGreaterThanOrEqual(70);
  });

  it('maps dominant rgb to palette distance', () => {
    const rgb = hexToRgb('#1e3a5f');
    expect(rgb).not.toBeNull();
    const delta = minDeltaEToPalette(rgb!, ['#1e3a5f', '#ffffff']);
    expect(delta).toBeLessThan(1);
  });
});

describe('content-media-stock.provider keywords', () => {
  it('extracts clip keywords from script', () => {
    const keywords = extractClipKeywords('Double-down educational content marketing carousel hook');
    expect(keywords.length).toBeGreaterThan(0);
  });
});

describe('ContentMediaCleanService', () => {
  const storage = {
    buildPublicUrl: (key: string) => `https://cdn.pttads.vn/cmkt/${key}`,
  };
  const cache = {
    deleteCleanBuffer: jest.fn(),
  };
  const svc = new ContentMediaCleanService(storage as never, cache as never);

  it('promotes clean asset url on approve', () => {
    const asset: CmktMediaAsset = {
      id: 'a1',
      type: 'image',
      url: 'https://cdn.pttads.vn/cmkt/1/2/a1.webp',
      ai_generated: true,
      provider: 'stub',
      draft_watermark: true,
      storage_key: '1/2/a1.webp',
      clean_storage_key: '1/2/a1-clean.webp',
    };
    const promoted = svc.promoteAsset(asset, 1, 2);
    expect(promoted.url).toContain('a1-clean.webp');
    expect(promoted.draft_watermark).toBe(false);
    expect(cache.deleteCleanBuffer).toHaveBeenCalledWith(1, 2, 'a1');
  });
});
