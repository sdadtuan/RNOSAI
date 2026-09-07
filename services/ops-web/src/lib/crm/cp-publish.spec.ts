import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCpPublishItem,
  getCpPublishGate,
  listCpChannelProfiles,
  listCpPublishItems,
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
});
