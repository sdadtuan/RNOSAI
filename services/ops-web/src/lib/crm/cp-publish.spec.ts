import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bulkCpPublishItems,
  createCpPublishItem,
  deliverCpPublishItem,
  getCpPublishGate,
  listCpChannelProfiles,
  listCpPublishHistory,
  listCpPublishItems,
  retryCpPublishItem,
} from './cp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CP publish API', () => {
  it('lists video publish items and channel profiles', async () => {
    const fetchMock = vi.fn().mockImplementation(() => (
      Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    ));
    vi.stubGlobal('fetch', fetchMock);

    await listCpPublishItems('token', { scope: 'team', channel: 'tiktok' });
    await listCpChannelProfiles('token');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/publish?scope=team&channel=tiktok');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/crm/cp/publish/profiles');
  });

  it('posts a video PublishItem and loads the gate', async () => {
    const fetchMock = vi.fn().mockImplementation(() => (
      Promise.resolve(new Response(JSON.stringify({ id: 'pub-1', kind: 'video' }), { status: 201 }))
    ));
    vi.stubGlobal('fetch', fetchMock);

    await createCpPublishItem('token', {
      video_version_id: '55555555-5555-4555-8555-555555555555',
      channel: 'tiktok',
    }, 'me');
    await getCpPublishGate('token', '55555555-5555-4555-8555-555555555555', 'all');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/publish?scope=me');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/api/crm/cp/publish/gate/55555555-5555-4555-8555-555555555555?scope=all',
    );
  });

  it('delivers, retries, bulks, and loads history on publish routes', async () => {
    const fetchMock = vi.fn().mockImplementation(() => (
      Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    ));
    vi.stubGlobal('fetch', fetchMock);

    await deliverCpPublishItem('token', '77777777-7777-4777-8777-777777777777', 'me');
    await retryCpPublishItem('token', '77777777-7777-4777-8777-777777777777', 'team');
    await bulkCpPublishItems('token', {
      video_version_ids: ['55555555-5555-4555-8555-555555555555'],
      channel: 'tiktok',
      rule: { n_per_day: 1, windows: [{ start: '09:00', end: '10:00' }], weekdays: [1] },
    }, 'all');
    await listCpPublishHistory('token', '77777777-7777-4777-8777-777777777777', 'me');

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/api/crm/cp/publish/77777777-7777-4777-8777-777777777777/deliver?scope=me',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/api/crm/cp/publish/77777777-7777-4777-8777-777777777777/retry?scope=team',
    );
    expect(fetchMock.mock.calls[2][0]).toContain('/api/crm/cp/publish/bulk?scope=all');
    expect(fetchMock.mock.calls[3][0]).toContain(
      '/api/crm/cp/publish/77777777-7777-4777-8777-777777777777/history?scope=me',
    );
  });
});
