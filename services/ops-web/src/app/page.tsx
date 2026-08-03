'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { HomeCskhWidgetRow } from '@/components/home/HomeCskhWidgetRow';
import { fetchCskhHomeSummary, fetchNestHealth, staffMe, staffRefresh } from '@/lib/api';
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

const HOME_SUMMARY_POLL_MS = 60_000;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [health, setHealth] = useState<string>('');
  const [homeSummary, setHomeSummary] = useState<Awaited<ReturnType<typeof fetchCskhHomeSummary>> | null>(
    null,
  );
  const [homeError, setHomeError] = useState('');
  const [homeLoading, setHomeLoading] = useState(false);

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

  useEffect(() => {
    if (!user) return;
    if (!hasCap(user, 'crm_leads', 'view')) return;

    let cancelled = false;

    async function loadSummary() {
      const token = getAccessToken();
      if (!token) return;
      setHomeLoading(true);
      try {
        const data = await fetchCskhHomeSummary(token);
        if (!cancelled) {
          setHomeSummary(data);
          setHomeError('');
        }
      } catch (err) {
        if (!cancelled) {
          setHomeError(err instanceof Error ? err.message : 'Không tải tóm tắt CSKH');
        }
      } finally {
        if (!cancelled) setHomeLoading(false);
      }
    }

    void loadSummary();
    const timer = window.setInterval(() => void loadSummary(), HOME_SUMMARY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

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

  const showCskhWidgets = hasCap(user, 'crm_leads', 'view');

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

      {showCskhWidgets ? (
        <div className="page-card home-cskh-widgets-card">
          <h2 className="home-cskh-widgets__title">CSKH Spa Meta — hôm nay</h2>
          <HomeCskhWidgetRow summary={homeSummary} loading={homeLoading} error={homeError} />
        </div>
      ) : null}

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
