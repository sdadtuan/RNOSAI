import { describe, expect, it } from 'vitest';
import { buildBrandVersionPayload, type CpBrandPayload } from './cp-api';

describe('buildBrandVersionPayload', () => {
  it('builds a new payload without mutating the previous version', () => {
    const previous: CpBrandPayload = {
      logos: { primary: 'asset-primary', light: '', mark: '', icon: '' },
      palette: ['#0f2747'],
      typography: { font_family: 'Inter', heading_weight: '700', body_weight: '400' },
      cta: { label: 'Xem thêm', url: '' },
      disclaimer: { text: '', channels: '' },
      motion: { intro: '', outro: '', caption_style: '', watermark: '' },
      audio: { sound_logo: '', voice_style: '', music_style: '' },
    };

    const next = buildBrandVersionPayload(previous, {
      ...previous,
      palette: ['#0f2747', '#ffffff'],
    });

    expect(next).not.toBe(previous);
    expect(next.palette).not.toBe(previous.palette);
    expect(previous.palette).toEqual(['#0f2747']);
    expect(next.palette).toEqual(['#0f2747', '#ffffff']);
  });
});
