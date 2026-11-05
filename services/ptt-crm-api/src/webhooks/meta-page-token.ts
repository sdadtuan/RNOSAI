import {
  pageAccessTokenFromPageNode,
  pickPageAccessTokenFromAccounts,
} from './meta-page-token.util';

type FetchLike = typeof fetch;

async function graphJson(
  fetchFn: FetchLike,
  version: string,
  path: string,
  token: string,
  fields: string,
): Promise<unknown> {
  const ver = version.trim() || 'v19.0';
  const url = `https://graph.facebook.com/${ver}/${path}?${new URLSearchParams({
    fields,
    access_token: token,
    limit: '50',
  }).toString()}`;
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
    return await res.json().catch(() => ({}));
  } catch {
    return {};
  }
}

/** User/System User token → Page token for the mapped Page. Falls back to the input token. */
export async function exchangeForPageAccessToken(
  rawToken: string,
  pageId: string,
  graphApiVersion: string,
  fetchFn: FetchLike = fetch,
): Promise<string> {
  const token = String(rawToken ?? '').trim();
  const page = String(pageId ?? '').trim();
  if (!token || !page) return token;

  const pageNode = await graphJson(fetchFn, graphApiVersion, encodeURIComponent(page), token, 'id,name,access_token');
  const fromPage = pageAccessTokenFromPageNode(pageNode);
  if (fromPage) return fromPage;

  const accounts = await graphJson(fetchFn, graphApiVersion, 'me/accounts', token, 'id,name,access_token');
  const fromAccounts = pickPageAccessTokenFromAccounts(accounts, page);
  if (fromAccounts) return fromAccounts;

  return token;
}
