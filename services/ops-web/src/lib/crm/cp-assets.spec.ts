import { afterEach, describe, expect, it, vi } from 'vitest';
import { replaceCpAsset } from './cp-api';

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
});
