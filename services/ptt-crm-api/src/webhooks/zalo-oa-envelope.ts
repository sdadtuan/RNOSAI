import { createHash, timingSafeEqual } from 'crypto';

function readPartyId(node: unknown): string {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return '';
  return String((node as { id?: unknown }).id ?? '').trim();
}

/** OA id and user id from the official Zalo envelope (sender/recipient), not the App ID. */
export function resolveZaloParties(
  payload: Record<string, unknown>,
  event: string,
): { oaId: string; userId: string } {
  const explicitOa = String(payload.oa_id ?? '').trim();
  const follower = payload.follower;
  const followerId =
    follower && typeof follower === 'object' && !Array.isArray(follower)
      ? String((follower as { id?: unknown }).id ?? '').trim()
      : '';
  const explicitUser = String(payload.user_id ?? payload.sender_id ?? '').trim();
  const senderId = readPartyId(payload.sender);
  const recipientId = readPartyId(payload.recipient);
  const oaSends = event.startsWith('oa_send');
  return {
    oaId: explicitOa || (oaSends ? senderId : recipientId),
    userId: followerId || explicitUser || (oaSends ? recipientId : senderId),
  };
}

export type ZaloSignatureFailure = 'missing_header' | 'bad_mac' | 'missing_fields' | 'mismatch';

function macCandidates(signatureHeader: string): string[] {
  return signatureHeader
    .split(',')
    .map((part) => part.trim().replace(/^mac=/i, '').toLowerCase())
    .filter((mac) => /^[a-f0-9]{64}$/.test(mac));
}

/** Why `X-ZEvent-Signature` failed. `null` means one of the secrets matched, or no secret is configured. */
export function zaloEventSignatureFailure(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secrets: string[],
): ZaloSignatureFailure | null {
  const usable = secrets.map((secret) => secret.trim()).filter(Boolean);
  if (!usable.length) return null;
  if (!signatureHeader?.trim()) return 'missing_header';
  const macs = macCandidates(signatureHeader);
  if (!macs.length) return 'bad_mac';

  let payload: Record<string, unknown>;
  try {
    const data = JSON.parse(rawBody.toString('utf8')) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'missing_fields';
    payload = data as Record<string, unknown>;
  } catch {
    return 'missing_fields';
  }

  const appId = String(payload.app_id ?? '').trim();
  const timestamp = String(payload.timestamp ?? '').trim();
  if (!appId || !timestamp) return 'missing_fields';

  for (const secret of usable) {
    const expected = createHash('sha256')
      .update(appId)
      .update(rawBody)
      .update(timestamp)
      .update(secret)
      .digest('hex');
    for (const mac of macs) {
      try {
        if (timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
      } catch {
        return 'bad_mac';
      }
    }
  }
  return 'mismatch';
}

/** Zalo header `X-ZEvent-Signature: mac=<sha256(appId + rawBody + timestamp + OA secret)>`. */
export function verifyZaloEventSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  return zaloEventSignatureFailure(rawBody, signatureHeader, [secret]) === null;
}
