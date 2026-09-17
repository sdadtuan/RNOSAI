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
}
