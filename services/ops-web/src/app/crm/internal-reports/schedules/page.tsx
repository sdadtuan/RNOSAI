'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
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
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Cài đặt</h1>
      <p className="mb-4 text-sm text-slate-500">Precreate · Digest · Reminder</p>
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/crm/internal-reports/lists" className="iwr-link">
          Danh sách phân phối
        </Link>
        {' · '}
        <Link href="/crm/internal-reports/builder" className="iwr-link">
          Report builder
        </Link>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="space-y-2" data-testid="iwr-schedules">
        {items.map((row) => (
          <IwrCard key={row.id}>
            <div className="font-medium capitalize">{row.kind}</div>
            <div className="text-xs text-slate-500">
              cron {row.cron_expr} · {row.timezone} · {row.active ? 'Bật' : 'Tắt'}
            </div>
          </IwrCard>
        ))}
        {!items.length && <div className="py-8 text-center text-sm text-slate-500">Chưa có lịch</div>}
      </div>
      <Link href="/crm/internal-reports" className="iwr-link">
        ← BC của tôi
      </Link>
    </IwrAppShell>
  );
}
