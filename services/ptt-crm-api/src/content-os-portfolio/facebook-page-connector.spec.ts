import { NotEnabledError, stubPublishConnector, resolvePublishConnector } from './publish-connector';
import { createFacebookPageConnector } from './facebook-page-connector';

describe('resolvePublishConnector', () => {
  it('returns stub when flag off, status off, no token, or test without facebook mock', () => {
    expect(resolvePublishConnector({
      direct_social_publish: false, connectorStatus: 'on', hasToken: true,
    }).id).toBe('stub');
    expect(resolvePublishConnector({
      direct_social_publish: true, connectorStatus: 'off', hasToken: true,
    }).id).toBe('stub');
    expect(resolvePublishConnector({
      direct_social_publish: true, connectorStatus: 'on', hasToken: false,
    }).id).toBe('stub');
  });
});

describe('FacebookPageConnector', () => {
  it('throws NotEnabledError when flag off', async () => {
    const c = createFacebookPageConnector({ enabled: false, statusOn: true });
    await expect(c.publish({ item_id: 1, page_id: '555', message: 'x', access_token: 't' } as never))
      .rejects.toBeInstanceOf(NotEnabledError);
  });

  it('posts feed and returns post_id without leaking token in error mapping', async () => {
    const graphFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '555_888' }),
    });
    const c = createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch });
    const out = await c.publish({
      item_id: 21, channel: 'facebook_page', page_id: '555', message: 'Sống xanh', access_token: 'SECRET',
    } as never);
    expect(out).toEqual({ post_id: '555_888' });
    const url = String(graphFetch.mock.calls[0][0]);
    expect(url).toContain('https://graph.facebook.com/v21.0/555/feed');
    expect(url).not.toContain('SECRET');
  });

  it('maps 4xx auth to TokenExpired code without Graph body', async () => {
    const graphFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth access token.' } }),
    });
    const c = createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch });
    await expect(c.publish({
      item_id: 1, page_id: '555', message: 'x', access_token: 'SECRET',
    } as never)).rejects.toMatchObject({ message: 'TokenExpired' });
  });

  it('maps 403 to TokenExpired and other 4xx to graph_rejected', async () => {
    const forbidden = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const rejected = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    await expect(
      createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch: forbidden }).publish({
        item_id: 1, page_id: '555', message: 'x', access_token: 'SECRET',
      } as never),
    ).rejects.toMatchObject({ message: 'TokenExpired' });
    await expect(
      createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch: rejected }).publish({
        item_id: 1, page_id: '555', message: 'x', access_token: 'SECRET',
      } as never),
    ).rejects.toMatchObject({ message: 'graph_rejected' });
  });

  it('does not retry POST /feed on 5xx', async () => {
    const graphFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'try again' } }),
    });
    const c = createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch });
    await expect(c.publish({
      item_id: 1, page_id: '555', message: 'x', access_token: 'SECRET',
    } as never)).rejects.toMatchObject({ message: 'graph_unavailable' });
    expect(graphFetch).toHaveBeenCalledTimes(1);
  });

  it('throws graph_missing_post_id when Graph JSON lacks a non-empty id', async () => {
    const graphFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const c = createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch });
    await expect(c.publish({
      item_id: 1, page_id: '555', message: 'x', access_token: 'SECRET',
    } as never)).rejects.toMatchObject({ message: 'graph_missing_post_id' });
  });
});

describe('stub still locked', () => {
  it('throws when direct_social_publish is on', async () => {
    await expect(stubPublishConnector({ direct_social_publish: true }).publish({ item_id: 1 }))
      .rejects.toBeInstanceOf(NotEnabledError);
  });
});
