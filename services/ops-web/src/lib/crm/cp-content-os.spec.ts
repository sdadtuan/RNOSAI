import { afterEach, describe, expect, it, vi } from 'vitest';
import { handoffContentOsToCreativeOs } from './cp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Content OS → Creative OS handoff API', () => {
  it('posts lifecycle + item to /content-os/handoff and returns draft href', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          draft_id: '22222222-2222-4222-8222-222222222222',
          href: '/crm/creative-os/video/22222222-2222-4222-8222-222222222222',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await handoffContentOsToCreativeOs('token', {
      lifecycle_id: 7,
      item_id: 42,
      name: 'Reel Peak',
      prompt: 'hook',
    });

    expect(fetchMock.mock.calls[0][0]).toContain('/api/crm/cp/content-os/handoff');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      lifecycle_id: 7,
      item_id: 42,
      name: 'Reel Peak',
      prompt: 'hook',
    });
    expect(out).toEqual({
      draft_id: '22222222-2222-4222-8222-222222222222',
      href: '/crm/creative-os/video/22222222-2222-4222-8222-222222222222',
    });
  });
});
