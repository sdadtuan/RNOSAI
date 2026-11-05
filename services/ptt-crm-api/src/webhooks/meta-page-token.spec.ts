import { exchangeForPageAccessToken } from './meta-page-token';

describe('exchangeForPageAccessToken', () => {
  it('uses Page node access_token when present', async () => {
    const fetchFn = jest.fn(async (url: string) => {
      expect(String(url)).toContain('/P1?');
      return {
        ok: true,
        json: async () => ({ id: 'P1', access_token: 'EAA_from_page' }),
      };
    });
    const out = await exchangeForPageAccessToken('USER_TOK', 'P1', 'v19.0', fetchFn as never);
    expect(out).toBe('EAA_from_page');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to me/accounts when Page node has no token', async () => {
    const fetchFn = jest.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/P1?')) {
        return { ok: true, json: async () => ({ id: 'P1', name: 'PTT' }) };
      }
      expect(u).toContain('/me/accounts');
      return {
        ok: true,
        json: async () => ({ data: [{ id: 'P1', access_token: 'EAA_from_accounts' }] }),
      };
    });
    const out = await exchangeForPageAccessToken('USER_TOK', 'P1', 'v19.0', fetchFn as never);
    expect(out).toBe('EAA_from_accounts');
  });

  it('returns the original token when Graph cannot exchange', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      json: async () => ({ error: { message: 'nope' } }),
    }));
    const out = await exchangeForPageAccessToken('USER_TOK', 'P1', 'v19.0', fetchFn as never);
    expect(out).toBe('USER_TOK');
  });
});
