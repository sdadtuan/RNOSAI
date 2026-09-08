export type QtSearchValue = string | string[] | undefined;

export type QtSearchParams = Record<string, QtSearchValue>;

function first(value: QtSearchValue): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return value?.trim() ?? '';
}

function appendForwarded(params: URLSearchParams, key: string, value: QtSearchValue) {
  if (value == null) return;
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed) params.append(key, trimmed);
  }
}

export function qtOverviewRedirect(searchParams: QtSearchParams): string | null {
  const id = first(searchParams.id);
  if (id) {
    return `/crm/proposals/${encodeURIComponent(id)}`;
  }

  const wizard = first(searchParams.wizard);
  const leadId = first(searchParams.lead_id);
  if (wizard !== '1' && !leadId) {
    return null;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'wizard' || key === 'id') continue;
    appendForwarded(params, key, value);
  }
  const query = params.toString();
  return query ? `/crm/proposals/new?${query}` : '/crm/proposals/new';
}
