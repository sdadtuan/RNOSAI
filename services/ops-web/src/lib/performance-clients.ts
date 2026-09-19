/** Shared client / project options for Performance OS filters. */
export const PM_CLIENT_OPTIONS = [
  '360 AUTO DETAILING',
  'Công ty An Phát',
  'Spa ABC',
  'EduNext',
] as const;

export const PM_PROJECT_OPTIONS = [
  'Growth Launch Q4',
  'Spa Lead Growth',
  'Student Recruitment',
  '360 Detailing Retainer',
] as const;

export type PmClientOption = (typeof PM_CLIENT_OPTIONS)[number];
export type PmProjectOption = (typeof PM_PROJECT_OPTIONS)[number];

export function matchesClientFilter(value: string | null | undefined, client: string): boolean {
  if (!client || client === 'all') return true;
  const hay = (value ?? '').toLowerCase();
  return hay.includes(client.toLowerCase());
}

export function matchesTextFilter(
  fields: Array<string | null | undefined>,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(needle));
}
