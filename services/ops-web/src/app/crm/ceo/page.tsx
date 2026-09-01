'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CeoCommandPanel } from '@/components/crm/ceo/CeoCommandPanel';
import { CeoLifecycleTower } from '@/components/crm/ceo/CeoLifecycleTower';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import { ceoCommandEnabled } from '@/lib/crm/ceo-command-flags';
import { canSeeCeoNav } from '@/lib/crm/ceo-command-thread.util';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function CeoCommandPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    if (!ceoCommandEnabled()) {
      setError('CEO Command đang tắt trên môi trường này');
      return null;
    }
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canSeeCeoNav(me)) {
        router.replace(`/403?from=${encodeURIComponent('/crm/ceo')}`);
        return null;
      }
      setToken(access);
      return access;
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
      setUser(me);
      updateStoredUser(me);
      if (!canSeeCeoNav(me)) {
        router.replace(`/403?from=${encodeURIComponent('/crm/ceo')}`);
        return null;
      }
      setToken(access);
      return access;
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Điều hành CEO' },
      ]}
    >
      <PageToolbar
        title="Điều hành CEO"
        subtitle="Briefing + hỏi số + hành động có xác nhận — nội bộ, không gửi khách."
      />
      {error ? (
        <div className="page-card stack-gap">
          <p className="error">{error}</p>
        </div>
      ) : null}
      {token && !error ? (
        <Suspense fallback={<div className="page-card"><p className="muted">Đang tải tháp…</p></div>}>
          <CeoLifecycleTower token={token} />
        </Suspense>
      ) : null}
      {token && !error ? <CeoCommandPanel token={token} staffName={user.display_name ?? user.email} /> : null}
    </StaffPageShell>
  );
}
