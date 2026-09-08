export function dash(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}
