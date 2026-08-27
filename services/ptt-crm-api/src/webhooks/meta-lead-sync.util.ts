export const FACEBOOK_SYNC_DEFAULT_LIMIT = 50;
export const FACEBOOK_SYNC_MAX_LIMIT = 100;

export type FacebookSyncFormTarget = { pageId: string; formId: string };

export type FacebookFormLeadsPage = {
  ids: string[];
  nextUrl: string | null;
  errorMessage?: string;
};

export type FetchedLeadClass = 'ok' | 'empty_contact' | 'graph_error';

export function clampFacebookSyncLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return FACEBOOK_SYNC_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), FACEBOOK_SYNC_MAX_LIMIT);
}

export function selectActiveFormsToSync(
  pages: Array<{
    page_id?: string | null;
    active?: boolean;
    forms?: Array<{ form_id?: string | null; active?: boolean }>;
  }>,
  formId?: string,
): FacebookSyncFormTarget[] {
  const wanted = String(formId ?? '').trim();
  const out: FacebookSyncFormTarget[] = [];
  for (const page of pages) {
    if (page.active === false) continue;
    const pageId = String(page.page_id ?? '').trim();
    if (!pageId) continue;
    for (const form of page.forms ?? []) {
      if (form.active === false) continue;
      const id = String(form.form_id ?? '').trim();
      if (!id) continue;
      if (wanted && id !== wanted) continue;
      out.push({ pageId, formId: id });
    }
  }
  return out;
}

export function parseFacebookFormLeadsPage(payload: unknown): FacebookFormLeadsPage {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const err = data.error;
  if (err && typeof err === 'object') {
    const message = String((err as { message?: unknown }).message ?? 'graph_error');
    return { ids: [], nextUrl: null, errorMessage: message };
  }
  const rows = Array.isArray(data.data) ? data.data : [];
  const ids = rows
    .map((row) => (row && typeof row === 'object' ? String((row as { id?: unknown }).id ?? '').trim() : ''))
    .filter(Boolean);
  const paging = data.paging && typeof data.paging === 'object' ? (data.paging as { next?: unknown }) : {};
  const nextUrl = String(paging.next ?? '').trim() || null;
  return { ids, nextUrl };
}

export function classifyFetchedLead(row: {
  phone?: string | null;
  email?: string | null;
  full_name?: string | null;
  meta?: Record<string, unknown> | null;
}): FetchedLeadClass {
  const fetchState = String(row.meta?.fetch ?? '');
  if (fetchState === 'graph_error' || fetchState === 'graph_exception') {
    return 'graph_error';
  }
  const phone = String(row.phone ?? '').trim();
  const email = String(row.email ?? '').trim();
  if (!phone && !email) return 'empty_contact';
  return 'ok';
}

export function facebookFormLeadsUrl(
  formId: string,
  token: string,
  graphApiVersion: string,
  limit: number,
): string {
  const version = graphApiVersion.trim() || 'v19.0';
  const params = new URLSearchParams({
    fields: 'id,created_time',
    limit: String(limit),
    access_token: token,
  });
  return `https://graph.facebook.com/${version}/${encodeURIComponent(formId)}/leads?${params.toString()}`;
}
