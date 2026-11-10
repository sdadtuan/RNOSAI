'use client';

import { useEffect } from 'react';
import { getAccessToken, syncAuthCookie } from '@/lib/auth';

/** Keeps the middleware cookie in sync and copies an older tab-only session into localStorage. */
export function AuthCookieSync() {
  useEffect(() => {
    if (getAccessToken()) syncAuthCookie();
  }, []);
  return null;
}
