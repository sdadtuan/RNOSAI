export type FacebookAuthUrlInput = {
  appId: string;
  redirectUri: string;
  state: string;
};

export type FacebookCodeExchangeInput = {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
  allowlist: Set<string>;
};

export type FacebookPageToken = {
  page_id: string;
  access_token: string;
  expires_at: Date;
};

type FacebookFetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export function buildFacebookAuthUrl(input: FacebookAuthUrlInput): string {
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', input.appId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('scope', 'pages_manage_posts,pages_read_engagement');
  return url.toString();
}

export async function exchangeFacebookCode(
  input: FacebookCodeExchangeInput,
  fetchFn: FacebookFetchFn,
): Promise<FacebookPageToken> {
  const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', input.appId);
  tokenUrl.searchParams.set('client_secret', input.appSecret);
  tokenUrl.searchParams.set('redirect_uri', input.redirectUri);
  tokenUrl.searchParams.set('code', input.code);

  const tokenRes = await fetchFn(tokenUrl.toString());
  if (!tokenRes.ok) {
    throw new Error('facebook_token_exchange_failed');
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: unknown; expires_in?: unknown };
  const userToken = typeof tokenJson.access_token === 'string' ? tokenJson.access_token : '';
  if (!userToken) {
    throw new Error('facebook_token_exchange_failed');
  }

  const expiresIn = Number(tokenJson.expires_in);
  const ttlSec = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  const expires_at = new Date(Date.now() + ttlSec * 1000);

  const accountsUrl = new URL('https://graph.facebook.com/v21.0/me/accounts');
  accountsUrl.searchParams.set('access_token', userToken);
  const accountsRes = await fetchFn(accountsUrl.toString());
  if (!accountsRes.ok) {
    throw new Error('facebook_pages_fetch_failed');
  }
  const accountsJson = (await accountsRes.json()) as {
    data?: Array<{ id?: unknown; access_token?: unknown }>;
  };
  const pages = Array.isArray(accountsJson.data) ? accountsJson.data : [];
  const match = pages.find((page) => {
    const id = typeof page.id === 'string' ? page.id : '';
    const token = typeof page.access_token === 'string' ? page.access_token : '';
    return Boolean(id && token && input.allowlist.has(id));
  });
  const pageId = typeof match?.id === 'string' ? match.id : '';
  const pageToken = typeof match?.access_token === 'string' ? match.access_token : '';
  if (!pageId || !pageToken) {
    throw new Error('page_not_allowlisted');
  }
  return {
    page_id: pageId,
    access_token: pageToken,
    expires_at,
  };
}
