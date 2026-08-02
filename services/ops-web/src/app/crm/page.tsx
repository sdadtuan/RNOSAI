'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import { fetchCrmBoard, staffMe, staffRefresh, type CrmBoardModuleCard } from '@/lib/api';
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

export default function CrmBoardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [modules, setModules] = useState<CrmBoardModuleCard[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const allowed =
        hasCap(me, 'crm_board', 'view') ||
        hasCap(me, 'crm_leads', 'view') ||
        hasCap(me, 'crm_board_customers', 'view');
      if (!allowed) {
        setError('Không có quyền CRM Board');
        return null;
      }
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
      return access;
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        const board = await fetchCrmBoard(access);
        setModules(board.modules ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được CRM board');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      breadcrumb={[{ label: 'CRM', href: '/crm' }, { label: 'Board' }]}
    >
      <HubPageLayout
        title="CRM Board"
        subtitle="Hub điều hướng module CRM theo quyền của bạn"
      >
        {error ? <p className="error">{error}</p> : null}
        {loading ? <p className="muted">Đang tải module…</p> : null}
        {!loading && modules.length === 0 && !error ? (
          <p className="muted">Chưa có module nào khả dụng với quyền hiện tại.</p>
        ) : null}
        <div className="hub-module-grid">
          {modules.map((mod) => (
            <Link key={mod.id} href={mod.href} className="summary-card">
              <span className="muted">{mod.description}</span>
              <strong>{mod.label}</strong>
            </Link>
          ))}
        </div>
      </HubPageLayout>
    </StaffPageShell>
  );
}
