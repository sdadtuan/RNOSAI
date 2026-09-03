'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { fetchIwrDashboard, type IwrDashRole } from '@/lib/crm/iwr-api';

const ROLES: { id: IwrDashRole; label: string }[] = [
  { id: 'staff', label: 'Nhân viên' },
  { id: 'leader', label: 'Quản lý' },
  { id: 'pm', label: 'PM' },
  { id: 'bod', label: 'Ban lãnh đạo' },
];

export default function IwrDashboardsPage() {
  const params = useSearchParams();
  const initial = (params.get('role') as IwrDashRole) || 'staff';
  const { user, token, error, setError, logout, canWrite } = useIwrPageAuth('view');
  const [role, setRole] = useState<IwrDashRole>(ROLES.some((r) => r.id === initial) ? initial : 'staff');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrDashboard(token, role);
      setData(out as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải dashboard thất bại');
    }
  }, [token, role, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const entries = data ? Object.entries(data) : [];

  return (
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user} canWrite={canWrite}>
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Dashboard</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={role === r.id ? 'iwr-tab is-active' : 'iwr-tab'}
            onClick={() => setRole(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div data-testid="iwr-dashboard">
        {data ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map(([k, v]) => (
                <IwrCard key={k}>
                  <div className="text-xs text-slate-500">{k}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                  </div>
                </IwrCard>
              ))}
            </div>
            <pre className="hidden">{JSON.stringify(data)}</pre>
          </>
        ) : (
          <p className="text-sm text-slate-500">Đang tải…</p>
        )}
      </div>
      <Link href="/crm/internal-reports" className="iwr-link">
        ← BC của tôi
      </Link>
    </IwrAppShell>
  );
}
