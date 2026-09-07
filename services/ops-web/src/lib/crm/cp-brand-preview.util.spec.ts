import { describe, expect, it } from 'vitest';
import {
  CP_PREVIEW_OVERLAY_CLIP,
  overlayClips,
  overlayFromBrandPayload,
  previewOverlayInput,
} from './cp-brand-preview.util';

describe('CP brand preview overlay', () => {
  it('syncs overlay from payload caption then CTA after async load', () => {
    const empty = overlayFromBrandPayload({
      motion: { caption_style: '' },
      cta: { label: '' },
    });
    const loaded = overlayFromBrandPayload({
      motion: { caption_style: 'Safe-area caption lockup' },
      cta: { label: 'Book now' },
    });

    expect(empty).toBe('');
    expect(loaded).toBe('Safe-area caption lockup');
    expect(overlayFromBrandPayload({
      motion: { caption_style: '' },
      cta: { label: 'Book now' },
    })).toBe('Book now');
  });

  it('does not submit empty overlay that would skip payload fallback', () => {
    expect(previewOverlayInput('')).toBeUndefined();
    expect(previewOverlayInput('   ')).toBeUndefined();
    expect(previewOverlayInput(null)).toBeUndefined();
    expect(previewOverlayInput('Keep this overlay')).toBe('Keep this overlay');
  });

  it('clip-warns when overlay is longer than 42', () => {
    expect(CP_PREVIEW_OVERLAY_CLIP).toBe(42);
    expect(overlayClips('x'.repeat(42))).toBe(false);
    expect(overlayClips('x'.repeat(43))).toBe(true);
  });
});
