import { staffMe, staffRefresh } from '@/lib/api';
import {
  applyStaffLoginResponse,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  syncAuthCookie,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

let refreshInFlight: Promise<string | null> | null = null;
/** Access token that already produced a background 401. Further polls must not hit the network. */
let haltedToken: string | null = null;

export function accessTokenExpired(token: string, nowMs = Date.now()): boolean {
  const expMs = readJwtExpMs(token);
  if (expMs == null) return false;
  return expMs <= nowMs + 15_000;
}

function readJwtExpMs(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isApiUnauthorized(err: unknown): boolean {
  return typeof err === 'object' && err != null && 'status' in err && (err as { status?: unknown }).status === 401;
}

export function noteBackgroundUnauthorized(token: string): void {
  if (token.trim()) haltedToken = token.trim();
}

/**
 * Token for nav/poll widgets. Refreshes once when the JWT is expired so those
 * calls are not a burst of 401s, and returns null after a 401 on this token.
 */
export async function staffTokenForBackground(): Promise<string | null> {
  const token = getAccessToken()?.trim() || null;
  if (!token) return null;
  if (haltedToken && haltedToken !== token) haltedToken = null;
  if (haltedToken === token) return null;
  if (!accessTokenExpired(token)) return token;
  const next = await refreshAccessToken();
  if (!next) {
    haltedToken = token;
    return null;
  }
  return next;
}

let ensureInFlight: Promise<{
  token: string | null;
  user: StoredStaffUser | null;
  cleared: boolean;
}> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;
    try {
      const out = await staffRefresh(refresh);
      applyStaffLoginResponse(out);
      return out.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Shared staff session ensure for Content OS (and similar dual-auth shells).
 * Single-flights the whole ensure + refresh so concurrent ensureAuth callers
 * cannot clearSession on a rotated refresh token.
 */
export async function ensureStaffAccessToken(): Promise<{
  token: string | null;
  user: StoredStaffUser | null;
  cleared: boolean;
}> {
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = (async () => {
    let access = getAccessToken();
    if (!access) {
      return { token: null, user: null, cleared: false };
    }
    if (accessTokenExpired(access)) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        clearSession();
        return { token: null, user: null, cleared: true };
      }
      access = refreshed;
    }
    try {
      const me = await staffMe(access);
      updateStoredUser(me);
      syncAuthCookie(me);
      return { token: access, user: me, cleared: false };
    } catch {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        clearSession();
        return { token: null, user: null, cleared: true };
      }
      try {
        const me = await staffMe(refreshed);
        updateStoredUser(me);
        syncAuthCookie(me);
        return { token: refreshed, user: me, cleared: false };
      } catch {
        clearSession();
        return { token: null, user: null, cleared: true };
      }
    }
  })().finally(() => {
    ensureInFlight = null;
  });
  return ensureInFlight;
}

/** Test-only: reset in-flight promises between cases. */
export function resetStaffSessionRefreshForTests(): void {
  refreshInFlight = null;
  ensureInFlight = null;
  haltedToken = null;
}
