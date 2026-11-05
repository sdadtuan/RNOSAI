import { createHash } from 'crypto';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function freezeSnapshot(payload: unknown) {
  return {
    payload,
    hash: createHash('sha256').update(canonicalJson(payload)).digest('hex'),
    closed_at: new Date().toISOString(),
  };
}

export function assertNotClosed(state: string) {
  if (state === 'closed') throw new Error('reopen_required');
}

export function assertRowVersion(expected: number, actual: number) {
  if (expected !== actual) throw new Error('stale_version');
}
