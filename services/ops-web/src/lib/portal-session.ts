const TOKEN_KEY = 'ptt_portal_token';
const REFRESH_KEY = 'ptt_portal_refresh';
const USER_KEY = 'ptt_portal_user';
const EXPIRES_KEY = 'ptt_portal_expires_at';

export interface PortalSessionUser {
  id: string;
  email: string;
  client_id: string;
  role: 'viewer' | 'approver';
}

export function savePortalSession(
  token: string,
  user: PortalSessionUser,
  refreshToken?: string,
  expiresInSec?: number,
): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  if (expiresInSec) {
    sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresInSec * 1000));
  }
  document.cookie = 'ptt_portal_session=1; path=/; SameSite=Lax';
}

export function readPortalSession(): { token: string; user: PortalSessionUser } | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const raw = sessionStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    const user = JSON.parse(raw) as PortalSessionUser;
    if (!user?.client_id) return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function clearPortalSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
  document.cookie = 'ptt_portal_session=; path=/; Max-Age=0; SameSite=Lax';
}
