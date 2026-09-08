import { dash } from './cp-format';

export const VIDEO_SOP_HUB = '/crm/video';

/** Hub Video SOP; gắn lifecycle khi project CP đã map dịch vụ. */
export function videoSopHref(lifecycleId?: string | number | null): string {
  const raw = String(lifecycleId ?? '').trim();
  if (!raw) return VIDEO_SOP_HUB;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${VIDEO_SOP_HUB}?lifecycle_id=${encodeURIComponent(String(numeric))}`;
  }
  return VIDEO_SOP_HUB;
}

export type ProjectSearchRow = {
  id: string;
  name?: string | null;
  client_name?: string | null;
};

export type ProjectSearchOption = {
  value: string;
  label: string;
};

export function formatProjectSearchOption(row: ProjectSearchRow): string {
  const name = String(row.name ?? '').trim();
  const client = String(row.client_name ?? '').trim();
  if (!name && !client) return dash(null);
  if (!client || client === name) return name || client;
  return `${name} — ${client}`;
}

export function projectSearchOptions(items: ProjectSearchRow[]): ProjectSearchOption[] {
  return items
    .filter((row) => String(row.id ?? '').trim())
    .map((row) => ({
      value: String(row.id),
      label: formatProjectSearchOption(row),
    }));
}

export function filterProjectOptions(
  options: ProjectSearchOption[],
  query: string,
): ProjectSearchOption[] {
  const needle = fold(query);
  if (!needle) return options;
  return options.filter((option) => fold(option.label).includes(needle) || fold(option.value).includes(needle));
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}
