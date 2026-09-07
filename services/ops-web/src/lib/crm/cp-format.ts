export function dash(value: unknown): string {
  return value == null ? '—' : String(value);
}
