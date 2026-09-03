'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { fetchIwrSchedules, type IwrScheduleRow } from '@/lib/crm/iwr-api';

export default function IwrSchedulesPage() {
  const { user, token, error, setError, logout } = useIwrPageAuth('schedule');
  const [items, setItems] = useState<IwrScheduleRow[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrSchedules(token);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải lịch thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <StaffPageShell user={user ?? null} onLogout={logout} loading={!user}>
      <PageToolbar title="Lịch nhắc BC" subtitle="Precreate · Digest · Reminder" />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="space-y-2" data-testid="iwr-schedules">
        {items.map((row) => (
          <div key={row.id} className="rounded border p-3">
            <div className="font-medium capitalize">{row.kind}</div>
            <div className="text-xs text-slate-500">
              cron {row.cron_expr} · {row.timezone} · {row.active ? 'Bật' : 'Tắt'}
            </div>
          </div>
        ))}
        {!items.length && <div className="text-slate-500 text-sm py-8 text-center">Chưa có lịch</div>}
      </div>
      <Link href="/crm/internal-reports" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
        ← BC của tôi
      </Link>
    </StaffPageShell>
  );
}
