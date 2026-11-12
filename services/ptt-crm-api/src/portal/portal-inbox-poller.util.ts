/** Portal inbox / Meta sync — env flags, on-demand TTL, overlap locks. */

export function isPortalWorkerProcess(): boolean {
  return (process.env.PTT_PROCESS_ROLE ?? '').trim().toLowerCase() === 'portal-worker';
}

function envFlagEnabled(raw: string | undefined, defaultValue: string): boolean {
  const value = (raw ?? defaultValue).trim().toLowerCase();
  return value !== '0' && value !== 'false' && value !== 'off' && value !== 'no';
}

/** Continuous inbox polling is opt-in. Worker and API both default off. */
export function portalInboxPollEnabled(): boolean {
  if (isPortalWorkerProcess()) {
    return envFlagEnabled(process.env.PTT_PORTAL_WORKER_INBOX_POLL, '0');
  }
  return envFlagEnabled(process.env.PTT_PORTAL_INBOX_POLL, '0');
}

/** Continuous insights polling is opt-in and worker-only. */
export function portalMetaInsightsPollEnabled(): boolean {
  if (!isPortalWorkerProcess()) return false;
  return envFlagEnabled(process.env.PTT_PORTAL_WORKER_META_INSIGHTS_POLL, '0');
}

/** If polling is explicitly re-enabled, keep it slow: 2 min – 1 hour, default 5 min. */
export function portalInboxPollIntervalMs(): number {
  const raw = Number(process.env.PTT_PORTAL_INBOX_POLL_MS ?? 300_000);
  const ms = Number.isFinite(raw) ? raw : 300_000;
  return Math.min(3_600_000, Math.max(120_000, ms));
}

export function portalMetaInsightsPollIntervalMs(): number {
  const raw = Number(process.env.PTT_PORTAL_META_INSIGHTS_POLL_MS ?? 3_600_000);
  const ms = Number.isFinite(raw) ? raw : 3_600_000;
  return Math.min(6 * 3_600_000, Math.max(15 * 60_000, ms));
}

/** Reuse a just-fetched Graph inbox/leads sync for 10-30 minutes (default 15). Webhook is the live path; sync=1 is fallback only. */
export function portalOnDemandTtlMs(): number {
  const raw = Number(process.env.PTT_PORTAL_ON_DEMAND_TTL_MS ?? 900_000);
  const ms = Number.isFinite(raw) ? raw : 900_000;
  return Math.min(1_800_000, Math.max(600_000, ms));
}

/** Insights change slowly; refresh at most hourly unless overridden (15 min – 6 h). */
export function portalInsightsOnDemandTtlMs(): number {
  const raw = Number(process.env.PTT_PORTAL_INSIGHTS_ON_DEMAND_TTL_MS ?? 3_600_000);
  const ms = Number.isFinite(raw) ? raw : 3_600_000;
  return Math.min(6 * 3_600_000, Math.max(15 * 60_000, ms));
}

export function portalPageTokenCacheMs(): number {
  const raw = Number(process.env.PTT_PORTAL_PAGE_TOKEN_CACHE_MS ?? 2 * 3_600_000);
  const ms = Number.isFinite(raw) ? raw : 2 * 3_600_000;
  return Math.min(6 * 3_600_000, Math.max(30 * 60_000, ms));
}

export function shouldReuseFreshSync(lastAt: number | undefined, now: number, ttlMs: number): boolean {
  if (!lastAt) return false;
  return now - lastAt < ttlMs;
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

export class KeyedSingleFlight {
  private readonly inflight = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const created = task().finally(() => {
      if (this.inflight.get(key) === created) this.inflight.delete(key);
    });
    this.inflight.set(key, created);
    return created;
  }
}
