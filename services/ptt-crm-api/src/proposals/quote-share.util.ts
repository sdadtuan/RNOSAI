import { createHash, randomBytes, randomInt } from 'crypto';

export const QUOTE_OTP_TTL_MS = 5 * 60 * 1000;
export const QUOTE_OTP_MAX_ATTEMPTS = 5;
export const PUBLIC_ACCEPT_CTA = 'Xác nhận đề xuất';

export function generateQuoteShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashQuoteShareToken(raw: string): string {
  return createHash('sha256').update(String(raw ?? '').trim()).digest('hex');
}

export function generateQuoteOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashQuoteOtp(raw: string): string {
  return hashQuoteShareToken(String(raw ?? '').replace(/\s+/g, ''));
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
