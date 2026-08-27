export function pageAccessTokenFromPageNode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const token = String((payload as { access_token?: unknown }).access_token ?? '').trim();
  return token || null;
}

export function pickPageAccessTokenFromAccounts(payload: unknown, pageId: string): string | null {
  const wanted = String(pageId ?? '').trim();
  if (!wanted) return null;
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(root.data)
    ? root.data
    : Array.isArray((root.accounts as { data?: unknown } | undefined)?.data)
      ? ((root.accounts as { data: unknown[] }).data)
      : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = String((row as { id?: unknown }).id ?? '').trim();
    const token = String((row as { access_token?: unknown }).access_token ?? '').trim();
    if (id === wanted && token) return token;
  }
  return null;
}
