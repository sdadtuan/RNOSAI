import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBrandVersionPayload,
  createBrandRule,
  listBrandRules,
  previewBrandKit,
  restoreBrandVersion,
  type CpBrandPayload,
} from './cp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('CP brand rules preview history API', () => {
  it('lists and creates kit rules', async () => {
    const fetchMock = vi.fn().mockImplementation(() => (
      Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    ));
    vi.stubGlobal('fetch', fetchMock);

    await listBrandRules('token', 'kit-1', 'team');
    await createBrandRule('token', 'kit-1', {
      condition_json: { channel: 'paid' },
      action_json: { disclaimer: true },
      enforcement: 'block_publish',
    }, 'me');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/brand-kits/kit-1/rules?scope=team');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/crm/cp/brand-kits/kit-1/rules?scope=me');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
  });

  it('previews four ratios and restores a version', async () => {
    const fetchMock = vi.fn().mockImplementation(() => (
      Promise.resolve(new Response(JSON.stringify({ n: 3, items: [] }), { status: 200 }))
    ));
    vi.stubGlobal('fetch', fetchMock);

    await previewBrandKit('token', 'kit-1', { overlay: 'x'.repeat(43) }, 'all');
    await restoreBrandVersion('token', 'kit-1', 1, 'me');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/brand-kits/kit-1/preview?scope=all');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/api/crm/cp/brand-kits/kit-1/versions/1/restore?scope=me',
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
  });
});
