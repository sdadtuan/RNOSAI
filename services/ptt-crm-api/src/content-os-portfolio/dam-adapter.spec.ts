import {
  DamNotConfiguredError,
  listDamOrEmpty,
  stubDamAdapter,
  toDamUrlMetadata,
  type DamAdapter,
} from './dam-adapter';

describe('DamAdapter stub', () => {
  it('exposes list({ collection }) and does not invent DAM assets', async () => {
    const adapter: DamAdapter = stubDamAdapter();
    await expect(adapter.list({ collection: 'approved' })).rejects.toBeInstanceOf(DamNotConfiguredError);
    await expect(adapter.list({ collection: 'approved' })).rejects.toMatchObject({
      name: 'DamNotConfiguredError',
      message: 'dam_not_configured',
    });
  });

  it('maps fail to empty list plus error string', async () => {
    await expect(listDamOrEmpty(stubDamAdapter(), { collection: 'approved' })).resolves.toEqual({
      items: [],
      error: 'dam_not_configured',
    });
  });

  it('maps adapter throws to a stable public code and never leaks raw messages', async () => {
    const adapter = stubDamAdapter({
      fetchList: async () => {
        throw new Error(
          'ECONNREFUSED vendor dump token=sk_live_abc https://cdn.example/x?X-Amz-Signature=deadbeef',
        );
      },
    });
    const log = jest.fn();
    const result = await listDamOrEmpty(adapter, { collection: 'approved' }, { log });
    expect(result).toEqual({ items: [], error: 'dam_unavailable' });
    expect(JSON.stringify(result)).not.toMatch(/ECONNREFUSED|sk_live|X-Amz-Signature|token=/i);
    expect(JSON.stringify(result)).not.toMatch(/Sunlight|Nova/i);
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/sk_live|X-Amz-Signature|token=/i);
  });

  it('treats a non-array adapter payload as dam_invalid_response, not silent empty success', async () => {
    const adapter = stubDamAdapter({
      fetchList: async () => ({ vendor: 'dump', signed_url: 'https://cdn.example/x?token=abc' }),
    });
    const result = await listDamOrEmpty(adapter, { collection: 'approved' });
    expect(result).toEqual({ items: [], error: 'dam_invalid_response' });
    expect(JSON.stringify(result)).not.toMatch(/signed_url|token=|cdn\.example/i);
  });

  it('treats a non-array list() result as dam_invalid_response', async () => {
    const adapter: DamAdapter = {
      list: async () => ({ not: 'an-array' }) as unknown as never,
    };
    await expect(listDamOrEmpty(adapter)).resolves.toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
  });

  it('returns URL metadata from a stubbed vendor and keeps rights pull optional', async () => {
    const adapter = stubDamAdapter({
      fetchList: async ({ collection }) => [
        {
          id: 'asset-1',
          url: 'https://dam.example/files/hero.jpg',
          collection,
          filename: 'hero.jpg',
          mime_type: 'image/jpeg',
          access_token: 'secret-token',
        },
      ],
    });
    const result = await listDamOrEmpty(adapter, { collection: 'approved' });
    expect(result.error).toBeUndefined();
    expect(result.items).toEqual([
      {
        id: 'asset-1',
        url: 'https://dam.example/files/hero.jpg',
        collection: 'approved',
        filename: 'hero.jpg',
        mime_type: 'image/jpeg',
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/token|secret/i);
  });

  it('treats an array with any malformed asset row as dam_invalid_response, not silent empty success', async () => {
    const allRejected = stubDamAdapter({
      fetchList: async () => [
        { id: 'missing', access_token: 'sk_live_abc' },
        { filename: 'no-url.jpg' },
      ],
    });
    const rejected = await listDamOrEmpty(allRejected, { collection: 'approved' });
    expect(rejected).toEqual({ items: [], error: 'dam_invalid_response' });
    expect(JSON.stringify(rejected)).not.toMatch(/sk_live|token|secret/i);

    const mixed = stubDamAdapter({
      fetchList: async () => [
        { id: 'ok', url: 'https://dam.example/ok.jpg' },
        { id: 'bad' },
      ],
    });
    await expect(listDamOrEmpty(mixed)).resolves.toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
  });
});

describe('toDamUrlMetadata', () => {
  it('keeps URL metadata and optional rights without inventing a collection', () => {
    expect(
      toDamUrlMetadata({
        id: 'a1',
        url: 'https://cdn.example/a1.png',
        rights: { status: 'Valid', territory: 'VN' },
      }),
    ).toEqual({
      id: 'a1',
      url: 'https://cdn.example/a1.png',
      rights: { status: 'Valid', territory: 'VN' },
    });
  });

  it('drops rows without a url and strips secret fields', () => {
    expect(toDamUrlMetadata({ id: 'missing', access_token: 'nope' })).toBeNull();
    expect(
      toDamUrlMetadata({
        url: 'https://cdn.example/ok.jpg',
        refresh_token: 'hidden',
        secret_json: { key: 'nope' },
      }),
    ).toEqual({
      id: 'https://cdn.example/ok.jpg',
      url: 'https://cdn.example/ok.jpg',
    });
  });
});
