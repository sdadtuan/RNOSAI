import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import {
  decryptAccessToken,
  encryptAccessToken,
  vaultConfigured,
} from '../../agency/token-vault.util';

const NONCE = 12;

/**
 * Prefer the shared token vault (PTT_TOKEN_VAULT_KEY). If that is not
 * configured locally, fall back to a key derived from the portal JWT
 * secret — never log either value.
 */
function fallbackKey(): Buffer {
  const raw = (
    process.env.PTT_CRM_INTERNAL_KEY ||
    process.env.PTT_PORTAL_JWT_SECRET ||
    'dev-pos-vault-change-me'
  ).trim();
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptCarrierToken(plaintext: string): Buffer {
  const text = String(plaintext ?? '').trim();
  if (!text) throw new Error('empty_token');
  if (vaultConfigured()) return encryptAccessToken(text);
  const nonce = randomBytes(NONCE);
  const cipher = createCipheriv('aes-256-gcm', fallbackKey(), nonce);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, enc, tag]);
}

export function decryptCarrierToken(blob: Buffer | null | undefined): string | null {
  if (!blob || blob.length <= NONCE + 16) return null;
  if (vaultConfigured()) {
    const fromVault = decryptAccessToken(blob);
    if (fromVault) return fromVault;
  }
  try {
    const nonce = blob.subarray(0, NONCE);
    const encTag = blob.subarray(NONCE);
    const tag = encTag.subarray(encTag.length - 16);
    const enc = encTag.subarray(0, encTag.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', fallbackKey(), nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Public view of a carrier account — token is never included, only a has_token flag. */
export function redactAccount(row: {
  id: string;
  carrier: string;
  label: string;
  shop_id: string;
  extra?: unknown;
  test_mode: boolean;
  active: boolean;
  token_encrypted?: Buffer | null;
}): Record<string, unknown> {
  return {
    id: row.id,
    carrier: row.carrier,
    label: row.label,
    shop_id: row.shop_id,
    extra: row.extra && typeof row.extra === 'object' ? stripSecrets(row.extra as Record<string, unknown>) : {},
    test_mode: row.test_mode,
    active: row.active,
    has_token: Boolean(row.token_encrypted && (row.token_encrypted as Buffer).length > 0),
  };
}

function stripSecrets(extra: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (/token|secret|password|key|auth/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}
