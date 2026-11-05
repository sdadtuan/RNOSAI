'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IntakeSalesKitAdminPanel } from '@/components/crm/intake/IntakeSalesKitAdminPanel';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
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

export default function CrmIntakeSalesKitPage() {
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
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'playbooks', 'configure') && !hasCap(me, 'crm_leads', 'configure')) {
        setError('Không có quyền cấu hình Kho Sales Kit');
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
      if (!hasCap(me, 'playbooks', 'configure') && !hasCap(me, 'crm_leads', 'configure')) {
        setError('Không có quyền cấu hình Kho Sales Kit');
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
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Kho Sales Kit' },
      ]}
    >
      <PageToolbar
        title="Kho Sales Kit"
        subtitle="Upload Q&A / PDF / ảnh theo folder dịch vụ. Duyệt file org trước khi kit Hỏi kho dùng được."
        actions={
          <Link href="/crm/intake" className="btn btn-sm btn-ghost">
            ← Intake
          </Link>
        }
      />

      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {token ? (
          <Suspense fallback={<p className="muted">Đang tải kho…</p>}>
            <IntakeSalesKitAdminPanel token={token} />
          </Suspense>
        ) : null}
      </div>
    </StaffPageShell>
  );
}
