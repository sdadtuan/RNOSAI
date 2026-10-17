'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { AePerformancePanel } from '@/components/crm/AePerformancePanel';
import { ApiError, staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function AePerformancePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setToken(access);
    staffMe(access)
      .then((me) => {
        setUser(me);
        updateStoredUser(me);
      })
      .catch(async (err: unknown) => {
        const refresh = getRefreshToken();
        if (!(err instanceof ApiError) || err.status !== 401 || !refresh) return;
        try {
          const out = await staffRefresh(refresh);
          updateAccessToken(out.access_token);
          setToken(out.access_token);
          const me = await staffMe(out.access_token);
          setUser(me);
          updateStoredUser(me);
        } catch {
          clearSession();
          router.replace('/login');
        }
      });
  }, [router]);

  return (
    <StaffPageShell user={user} onLogout={logout} width="full" breadcrumb={[{ label: 'Hiệu suất AE' }]}>
      <PageToolbar title="Hiệu suất theo Owner" subtitle="Lead được phân công cho AE. Lọc dự án để xem từng dự án." />
      {token ? <AePerformancePanel token={token} /> : null}
    </StaffPageShell>
  );
}
