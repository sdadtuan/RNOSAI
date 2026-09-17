'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  canViewContentOs,
  getStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { ensureStaffAccessToken } from '@/lib/crm/staff-session';

export function useCmktEPageAuth() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [error, setError] = useState('');

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    const cached = getStoredUser();
    if (cached) setUser(cached);

    const out = await ensureStaffAccessToken();
    if (out.cleared || !out.token) {
      router.replace('/login');
      return null;
    }
    if (!out.user || !canViewContentOs(out.user)) {
      setError('Không có quyền Content Marketing OS');
      return null;
    }
    setUser(out.user);
    return out.token;
  }, [router]);

  return { user, error, setError, ensureAuth, router };
}

export function parseLifecycleQuery(raw: string | null): number | undefined {
  const n = Number(raw ?? '');
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
