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

export function isMissingFormPermissionError(message: string): boolean {
  const s = String(message ?? '').toLowerCase();
  return (
    s.includes('does not exist') ||
    s.includes('missing permissions') ||
    s.includes('unsupported get request')
  );
}

export const FACEBOOK_LEADGEN_FORMS_MAX_PAGES = 10;

export type FacebookLeadgenForm = {
  form_id: string;
  name: string;
  active: boolean;
};

export type FacebookLeadgenFormsPage = {
  forms: FacebookLeadgenForm[];
  nextUrl: string | null;
  errorMessage?: string;
};

export function redactGraphToken(message: string): string {
  return String(message ?? '')
    .replace(/access_token=[^&\s]+/gi, 'access_token=…')
    .slice(0, 240);
}

export function facebookLeadgenFormsUrl(pageId: string, token: string, graphApiVersion: string): string {
  const version = graphApiVersion.trim() || 'v19.0';
  const params = new URLSearchParams({
    fields: 'id,name,status',
    limit: '100',
    access_token: token,
  });
  return `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/leadgen_forms?${params.toString()}`;
}

export function parseFacebookLeadgenFormsPage(payload: unknown): FacebookLeadgenFormsPage {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const err = data.error;
  if (err && typeof err === 'object') {
    const message = String((err as { message?: unknown }).message ?? 'graph_error');
    return { forms: [], nextUrl: null, errorMessage: message };
  }
  const rows = Array.isArray(data.data) ? data.data : [];
  const forms: FacebookLeadgenForm[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as { id?: unknown; name?: unknown; status?: unknown };
    const formId = String(rec.id ?? '').trim();
    if (!formId) continue;
    const status = String(rec.status ?? '').trim().toUpperCase();
    if (status === 'DELETED') continue;
    forms.push({
      form_id: formId,
      name: String(rec.name ?? '').trim(),
      active: status === '' || status === 'ACTIVE',
    });
  }
  const paging = data.paging && typeof data.paging === 'object' ? (data.paging as { next?: unknown }) : {};
  const nextRaw = String(paging.next ?? '').trim();
  const nextUrl = nextRaw.startsWith('https://graph.facebook.com/') ? nextRaw : null;
  return { forms, nextUrl };
}

export async function fetchFacebookLeadgenForms(
  pageId: string,
  token: string,
  graphApiVersion: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ forms: FacebookLeadgenForm[]; errorMessage?: string }> {
  const forms: FacebookLeadgenForm[] = [];
  const seen = new Set<string>();
  let url: string | null = facebookLeadgenFormsUrl(pageId, token, graphApiVersion);
  let pages = 0;
  while (url && pages < FACEBOOK_LEADGEN_FORMS_MAX_PAGES) {
    pages += 1;
    const res = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
    const payload = (await res.json().catch(() => ({}))) as unknown;
    const page = parseFacebookLeadgenFormsPage(payload);
    if (page.errorMessage) return { forms, errorMessage: page.errorMessage };
    for (const form of page.forms) {
      if (seen.has(form.form_id)) continue;
      seen.add(form.form_id);
      forms.push(form);
    }
    url = page.nextUrl;
  }
  return { forms };
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
