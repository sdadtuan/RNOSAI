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

  it('turns a network fail into empty list plus error and never seeds Sunlight/Nova', async () => {
    const adapter = stubDamAdapter({
      fetchList: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    const result = await listDamOrEmpty(adapter, { collection: 'approved' });
    expect(result).toEqual({ items: [], error: 'ECONNREFUSED' });
    expect(JSON.stringify(result)).not.toMatch(/Sunlight|Nova/i);
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
