'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
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

type DeliveryPageGateProps = {
  children: ReactNode;
};

export function DeliveryPageGate({ children }: DeliveryPageGateProps) {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const ensureAuth = useCallback(async () => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      const canView =
        hasCap(me, 'crm_delivery_projects', 'view') || hasCap(me, 'crm_b2b_projects', 'view');
      if (!canView) setError('Không có quyền Project Delivery');
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      const canView =
        hasCap(me, 'crm_delivery_projects', 'view') || hasCap(me, 'crm_b2b_projects', 'view');
      if (!canView) setError('Không có quyền Project Delivery');
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await ensureAuth();
      setLoading(false);
    })();
  }, [ensureAuth]);

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
      loading={loading}
      width="full"
    >
      {error ? <p className="error">{error}</p> : null}
      {!error && user ? <div className="kpi-hub-embed">{children}</div> : null}
    </StaffPageShell>
  );
}
