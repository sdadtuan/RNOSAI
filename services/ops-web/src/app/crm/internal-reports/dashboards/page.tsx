'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
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
  const { user, token, error, setError, logout } = useIwrPageAuth('view');
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

  return (
    <StaffPageShell user={user ?? null} onLogout={logout} loading={!user}>
      <PageToolbar title="Dashboard BC nội bộ" subtitle="Theo vai trò" />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`px-3 py-1.5 rounded text-sm border ${role === r.id ? 'bg-slate-800 text-white' : 'bg-white'}`}
            onClick={() => setRole(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="rounded border p-4 bg-white" data-testid="iwr-dashboard">
        {data ? (
          <pre className="text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        ) : (
          <p className="text-slate-500 text-sm">Đang tải…</p>
        )}
      </div>
      <Link href="/crm/internal-reports" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
        ← BC của tôi
      </Link>
    </StaffPageShell>
  );
}
