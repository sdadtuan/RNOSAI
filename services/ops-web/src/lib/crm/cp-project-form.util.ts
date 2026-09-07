import { dash } from './cp-format';

export type CpLookupClient = {
  id: string;
  name: string;
  industry?: string | null;
};

export type CpLookupStaff = {
  id: number;
  name: string;
  job_title?: string | null;
};

export type CpLookupLifecycle = {
  id: string;
  service_slug: string | null;
};

export function formatLifecycleOption(row: { id?: string; service_slug?: string | null }): string {
  const id = String(row.id ?? '').trim();
  const slug = String(row.service_slug ?? '').trim();
  if (!id && !slug) return dash(null);
  return `LC-${id || '—'} — ${slug || dash(null)}`;
}

export function industryFromClient(client?: { industry?: string | null } | null): string {
  return String(client?.industry ?? '').trim();
}

export function parseMemberStaffIds(values: Array<string | number | null | undefined>): number[] {
  const ids: number[] = [];
  for (const value of values) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function formatStaffOption(row: CpLookupStaff): string {
  const title = String(row.job_title ?? '').trim();
  return title ? `${row.name} · ${title}` : row.name;
}
