import { createCipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { HttpException } from '@nestjs/common';

const DEFAULT_TTL_SEC = 600;
const NONCE_LEN = 12;
const KEY_LEN = 32;

export function requireSecretEncryptKey(): Buffer {
  const raw = (process.env.PTT_SECRET_ENCRYPT_KEY ?? '').trim();
  const key = Buffer.from(raw, 'utf8');
  if (key.length !== KEY_LEN) {
    throw Object.assign(new HttpException({ error: 'secret_key_missing' }, 503), {
      error: 'secret_key_missing',
    });
  }
  return key;
}

export function encryptProviderSecret(plaintext: string): string {
  const text = String(plaintext ?? '');
  if (!text) {
    throw Object.assign(new HttpException({ error: 'secret_required' }, 400), {
      error: 'secret_required',
    });
  }
  const key = requireSecretEncryptKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, enc, tag]).toString('base64');
}

export function createMagnificOAuthState(input: {
  staffId: number;
  ttlSec?: number;
}): { state: string; expiresAt: Date } {
  const key = requireSecretEncryptKey();
  const ttlSec = input.ttlSec && input.ttlSec > 0 ? input.ttlSec : DEFAULT_TTL_SEC;
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  const payload = Buffer.from(JSON.stringify({
    staffId: input.staffId,
    exp: expiresAt.toISOString(),
    nonce: randomBytes(12).toString('base64url'),
  }), 'utf8').toString('base64url');
  const sig = createHmac('sha256', key).update(payload).digest('base64url');
  return { state: `${payload}.${sig}`, expiresAt };
}

export function verifyMagnificOAuthState(state: string, now?: Date): { staffId: number } {
  const raw = String(state ?? '');
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) {
    throw new Error('invalid_oauth_state');
  }
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const key = requireSecretEncryptKey();
  const expected = createHmac('sha256', key).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('invalid_oauth_state');
  }
  let data: { staffId?: unknown; exp?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      staffId?: unknown;
      exp?: unknown;
    };
  } catch {
    throw new Error('invalid_oauth_state');
  }
  const staffId = Number(data.staffId);
  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new Error('invalid_oauth_state');
  }
  const exp = new Date(String(data.exp ?? ''));
  if (Number.isNaN(exp.getTime()) || exp.getTime() <= (now ?? new Date()).getTime()) {
    throw new Error('oauth_state_expired');
  }
  return { staffId };
}

export function redactConnectionRow(row: Record<string, unknown>): {
  id: string;
  provider: string;
  status: string;
  account_label: string | null;
  expires_at: string | null;
  has_secret: boolean;
} {
  return {
    id: String(row.id ?? ''),
    provider: String(row.provider ?? ''),
    status: String(row.status ?? ''),
    account_label: row.account_label == null || row.account_label === ''
      ? null
      : String(row.account_label),
    expires_at: formatExpiresAt(row.expires_at),
    has_secret: Boolean(row.secret_ref),
  };
}

function formatExpiresAt(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}
