import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addCpCollectionItem,
  createCpCollection,
  getCpQuality,
  listCpCollections,
  removeCpCollectionItem,
} from './cp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CP collections + quality API', () => {
  it('lists and creates collections under /collections', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'col-1',
        name: 'Images',
        smart_filter_json: { mime: 'image/' },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await listCpCollections('token', 'me');
    await createCpCollection('token', {
      name: 'Images',
      smart_filter_json: { mime: 'image/' },
    }, 'me');

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/collections?scope=me'),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/collections?scope=me'),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('adds and removes in-scope collection items', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset_id: 'asset-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await addCpCollectionItem('token', 'col-1', { asset_id: 'asset-1' }, 'team');
    await removeCpCollectionItem('token', 'col-1', 'asset-1', 'team');

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/collections/col-1/items?scope=team'),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/collections/col-1/items/asset-1?scope=team'),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('loads quality as missing metadata + hash duplicates without delete', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        missing_metadata_count: 1,
        duplicates: [{ hash: 'dup', count: 2 }],
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const report = await getCpQuality('token', 'me');

    expect(report.missing_metadata_count).toBe(1);
    expect(report.duplicates[0]).toMatchObject({ hash: 'dup', count: 2 });
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/quality?scope=me'),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method ?? 'GET').not.toBe('DELETE');
  });
});
