import { API_BASE } from '@/lib/api';
import { applyBusinessCalendarPayload } from '@/lib/crm/business-hours';

/** Re-read the backend calendar at most this often (backend reloads every 5 minutes too). */
export const BUSINESS_CALENDAR_TTL_MS = 5 * 60 * 1000;

let loadedAt = 0;
let inflight: Promise<boolean> | null = null;

/**
 * Load the calendars the API uses (GET /api/team-sla/business-calendar) into the business-hours
 * registry. Cached for 5 minutes; on any error the current (default 08:30–18:30 T2–T6) stays.
 * Resolves true when a fresh calendar was applied.
 */
export function ensureBusinessCalendars(token: string, now: number = Date.now()): Promise<boolean> {
  if (loadedAt && now - loadedAt < BUSINESS_CALENDAR_TTL_MS) return Promise.resolve(false);
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/team-sla/business-calendar`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return false;
        applyBusinessCalendarPayload((await res.json()) as unknown);
        loadedAt = Date.now();
        return true;
      } catch {
        return false;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Tests only. */
export function resetBusinessCalendarCache(): void {
  loadedAt = 0;
  inflight = null;
}
