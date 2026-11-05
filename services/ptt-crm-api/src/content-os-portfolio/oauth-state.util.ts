import * as crypto from 'crypto';

export function createOauthState(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function isOauthStateExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() > expiresAt.getTime();
}
