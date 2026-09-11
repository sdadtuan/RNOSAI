import { parsePageAllowlist } from './fb-page-allowlist.util';
import { buildFacebookAuthUrl, exchangeFacebookCode } from './facebook-oauth.util';

describe('facebook oauth', () => {
  it('builds dialog URL without ads_management', () => {
    const url = buildFacebookAuthUrl({
      appId: 'app-1',
      redirectUri: 'https://api.example/cb',
      state: 'st-1',
    });
    expect(url).toContain('https://www.facebook.com/v21.0/dialog/oauth');
    expect(url).toContain('pages_manage_posts');
    expect(url).toContain('pages_read_engagement');
    expect(url).not.toMatch(/ads_management/);
  });

  it('exchanges code, picks allowlisted page, never returns user token to caller shape with extra secrets', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'USER_TOKEN', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: '999', access_token: 'PAGE_TOKEN', name: 'Other' }, { id: '555', access_token: 'PAGE_OK', name: 'PTT Ads' }],
        }),
      });
    const out = await exchangeFacebookCode(
      {
        code: 'abc',
        redirectUri: 'https://api.example/cb',
        appId: 'app-1',
        appSecret: 'sec',
        allowlist: parsePageAllowlist('555'),
      },
      fetchFn,
    );
    expect(out).toEqual({
      page_id: '555',
      access_token: 'PAGE_OK',
      expires_at: expect.any(Date),
    });
    expect(JSON.stringify(out)).not.toMatch(/USER_TOKEN/);
  });

  it('rejects page outside allowlist', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'U', expires_in: 60 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '999', access_token: 'P' }] }) });
    await expect(
      exchangeFacebookCode(
        { code: 'c', redirectUri: 'https://x', appId: 'a', appSecret: 's', allowlist: parsePageAllowlist('555') },
        fetchFn,
      ),
    ).rejects.toMatchObject({ message: 'page_not_allowlisted' });
  });
});
