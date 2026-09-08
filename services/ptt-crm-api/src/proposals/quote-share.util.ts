import { createHash, randomBytes } from 'crypto';

export function generateQuoteShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashQuoteShareToken(raw: string): string {
  return createHash('sha256').update(String(raw ?? '').trim()).digest('hex');
}

export function shareExpiresAt(ttlDays: number): Date {
  const days = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 14;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function isTimestampPast(value: string | null | undefined, now = Date.now()): boolean {
  if (value == null || value === '') return false;
  const raw = String(value).trim();
  const ms = raw.length <= 10 ? Date.parse(`${raw}T23:59:59.999Z`) : Date.parse(raw);
  return Number.isFinite(ms) && ms <= now;
}
