import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCpAssetStreamUrl, listCpVideoPreviews, replaceCpAsset } from './cp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CP asset version API', () => {
  it('replaces a file via POST /assets/:id/replace', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'v2', n: 2, storage_key: 'new-key' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await replaceCpAsset('token', 'asset-1', {
      mime: 'image/jpeg',
      storage_key: 'new-key',
      bytes: 20,
    });

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/assets/asset-1/replace');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('mints a signed stream URL via GET /assets/:id/stream-url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        url: '/api/crm/cp/assets/asset-1/file?exp=1&sig=abc',
        mime: 'video/mp4',
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getCpAssetStreamUrl('token', 'asset-1', 'all');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/assets/asset-1/stream-url');
    expect(fetchMock.mock.calls[0][0]).toContain('scope=all');
  });

  it('lists studio previews via GET /videos/:id/previews', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listCpVideoPreviews('token', 'draft-1', 'all');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/videos/draft-1/previews');
    expect(fetchMock.mock.calls[0][0]).toContain('scope=all');
  });
});
