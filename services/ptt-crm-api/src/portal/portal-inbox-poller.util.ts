/** Portal inbox background poller — env + overlap lock (testable without Nest). */

export function isPortalWorkerProcess(): boolean {
  return (process.env.PTT_PROCESS_ROLE ?? '').trim().toLowerCase() === 'portal-worker';
}

/** Main API reads PTT_PORTAL_INBOX_POLL (default off). Worker ignores that flag so .env can disable the API copy. */
export function portalInboxPollEnabled(): boolean {
  if (isPortalWorkerProcess()) {
    const raw = (process.env.PTT_PORTAL_WORKER_INBOX_POLL ?? '1').trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
  }
  const raw = (process.env.PTT_PORTAL_INBOX_POLL ?? '0').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

export function portalMetaInsightsPollEnabled(): boolean {
  if (!isPortalWorkerProcess()) return false;
  const raw = (process.env.PTT_PORTAL_WORKER_META_INSIGHTS_POLL ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

export function portalInboxPollIntervalMs(): number {
  const raw = Number(process.env.PTT_PORTAL_INBOX_POLL_MS ?? 45_000);
  const ms = Number.isFinite(raw) ? raw : 45_000;
  return Math.min(120_000, Math.max(15_000, ms));
}

export function portalMetaInsightsPollIntervalMs(): number {
  const raw = Number(process.env.PTT_PORTAL_META_INSIGHTS_POLL_MS ?? 900_000);
  const ms = Number.isFinite(raw) ? raw : 900_000;
  return Math.min(3_600_000, Math.max(60_000, ms));
}

export function portalMetaWebhookVerifyToken(): string {
  const primary = (process.env.PTT_META_WEBHOOK_VERIFY_TOKEN ?? '').trim();
  if (primary) return primary;
  const legacy = (process.env.CRM_FACEBOOK_VERIFY_TOKEN ?? process.env.FACEBOOK_VERIFY_TOKEN ?? '').trim();
  return legacy;
}

export function verifyMetaHubSubscribe(
  query: Record<string, string | undefined>,
  expectedToken: string,
): { ok: boolean; challenge?: string } {
  const mode = query['hub.mode'] ?? query.hub_mode ?? '';
  if (mode !== 'subscribe') return { ok: false };
  const token = query['hub.verify_token'] ?? query.hub_verify_token ?? '';
  if (!expectedToken || token !== expectedToken) return { ok: false };
  const challenge = query['hub.challenge'] ?? query.hub_challenge ?? '';
  return { ok: true, challenge: String(challenge) };
}

export function isFacebookRateOrThrottleError(message: string): boolean {
  const low = message.toLowerCase();
  return (
    /rate limit|too many calls|application request limit|(#4|#17|#32)/i.test(low) ||
    low.includes('request limit reached')
  );
}

export class InboxPollOverlapLock {
  private flying = false;

  tryAcquire(): boolean {
    if (this.flying) return false;
    this.flying = true;
    return true;
  }

  release(): void {
    this.flying = false;
  }

  get busy(): boolean {
    return this.flying;
  }
}
