import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  duplicateQtOption,
  getQtKpis,
  getQtOptions,
  getQtStudioPreview,
  getQtVersionDiff,
  getQtVersions,
  patchQtOption,
  patchQtStudioSections,
  postQtOption,
  publishQtVersion,
} from './qt-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('QT builder W2 clients', () => {
  it('lists and writes options on Task 21 quote-versions paths', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok({ options: [] })));
    vi.stubGlobal('fetch', fetchMock);

    await getQtOptions('tok', 'vid-1');
    await postQtOption('tok', 'vid-1', { name: 'Growth', recommended: true, client_visible: true });
    await patchQtOption('tok', 'vid-1', 'B', { recommended: true, client_visible: false });
    await duplicateQtOption('tok', 'vid-1', 'A');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/crm/quote-versions/vid-1/options');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/crm/quote-versions/vid-1/options');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/api/crm/quote-versions/vid-1/options/B');
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain(
      '/api/crm/quote-versions/vid-1/options/A/duplicate',
    );
  });

  it('loads KPI rows, versions, and Task 23 version diffs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ kpis: [] }))
      .mockResolvedValueOnce(ok({ versions: [] }))
      .mockResolvedValueOnce(ok({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getQtKpis('tok', 'vid-1');
    await getQtVersions('tok', 9);
    await getQtVersionDiff('tok', 9, 1, 2);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/crm/quote-versions/vid-1/kpis');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/crm/proposals/9/versions');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/api/crm/proposals/9/versions/1/diff/2');
  });
});

describe('QT studio publish + preview clients', () => {
  it('preview GET, section PATCH, and publish POST hit Task 24 quote-versions paths', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ title: 'Growth', cta: { accept: 'Xác nhận đề xuất' } }))
      .mockResolvedValueOnce(ok({ ok: true }))
      .mockResolvedValueOnce(ok({ title: 'Growth', cta: { accept: 'Xác nhận đề xuất' } }));
    vi.stubGlobal('fetch', fetchMock);

    await getQtStudioPreview('tok', 'vid-1');
    await patchQtStudioSections('tok', 'vid-1', { '08': true, '09': true });
    await publishQtVersion('tok', 'vid-1');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/crm/quote-versions/vid-1/preview');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/crm/quote-versions/vid-1/studio');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'POST' });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/api/crm/quote-versions/vid-1/publish');
  });
});
