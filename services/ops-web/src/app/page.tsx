'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { fetchNestHealth, staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [health, setHealth] = useState<string>('');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);

    staffMe(token)
      .then((me) => {
        setUser(me);
        updateStoredUser(me);
      })
      .catch(async () => {
        const refresh = getRefreshToken();
        if (!refresh) {
          clearSession();
          router.replace('/login');
          return;
        }
        try {
          const out = await staffRefresh(refresh);
          updateAccessToken(out.access_token);
          updateStoredUser({ ...out.user, caps: undefined });
          const me = await staffMe(out.access_token);
          setUser(me);
          updateStoredUser(me);
        } catch {
          clearSession();
          router.replace('/login');
        }
      });

    fetchNestHealth()
      .then((h) => setHealth(JSON.stringify(h, null, 0).slice(0, 120)))
      .catch(() => setHealth('unavailable'));
  }, [router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[{ label: 'Tổng quan' }]}
    >
      <PageToolbar
        title={`Chào ${user.display_name || user.email}`}
        subtitle="Phase 2 — ops-web: CRM leads, Agency clients, Meta hub, Hub campaign map (Nest + PG)."
      />
      <div className="page-card">
        <div className="summary-grid">
          <div className="summary-card">
            <span className="muted">Quyền CRM leads</span>
            <strong>
              {user.caps?.some((c) => c.section === 'crm_leads') ? 'Có' : 'Chưa cấp'}
            </strong>
          </div>
          <div className="summary-card">
            <span className="muted">Caps</span>
            <strong>{user.caps?.length ?? 0}</strong>
          </div>
          <div className="summary-card">
            <span className="muted">API health</span>
            <strong style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{health || '…'}</strong>
          </div>
        </div>
      </div>
    </StaffPageShell>
  );
}
