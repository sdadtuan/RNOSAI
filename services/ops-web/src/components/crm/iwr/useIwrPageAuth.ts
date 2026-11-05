'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';

export function useIwrPageAuth(requiredAction: 'view' | 'write' | 'review' | 'manage' | 'lists' | 'schedule' = 'view') {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);

    async function finish(me: StoredStaffUser, accessToken: string): Promise<string | null> {
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'iwr', requiredAction)) {
        router.replace(`/403?from=${encodeURIComponent(window.location.pathname)}`);
        return null;
      }
      setToken(accessToken);
      return accessToken;
    }

    try {
      const me = await staffMe(access);
      return finish(me, access);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      return finish(me, access);
    }
  }, [router, requiredAction]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  return {
    user,
    token,
    error,
    setError,
    ensureAuth,
    logout,
    canWrite: hasCap(user, 'iwr', 'write'),
    canReview: hasCap(user, 'iwr', 'review'),
    canManage: hasCap(user, 'iwr', 'manage'),
    canBcc: hasCap(user, 'iwr', 'bcc'),
    canLists: hasCap(user, 'iwr', 'lists'),
    canSchedule: hasCap(user, 'iwr', 'schedule'),
  };
}
