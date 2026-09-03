'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import {
  IWR_STATUS_LABELS,
  IWR_TEMPLATE_CODES,
  backfillIwrReport,
  createIwrReport,
  fetchIwrReports,
  formatIwrWhen,
  type IwrReportRow,
} from '@/lib/crm/iwr-api';

export default function InternalReportsPage() {
  const router = useRouter();
  const { user, token, error, setError, logout, canWrite } = useIwrPageAuth('view');
  const [items, setItems] = useState<IwrReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [backfillYmd, setBackfillYmd] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrReports(token);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openToday() {
    if (!token || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const created = await createIwrReport(token, { template_code: 'daily_work' });
      router.push(`/crm/internal-reports/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo báo cáo ngày thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function openWeek() {
    if (!token || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const created = await createIwrReport(token, { template_code: 'weekly_work' });
      router.push(`/crm/internal-reports/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo báo cáo tuần thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout}>
      <PageToolbar title="BC công việc" subtitle="Báo cáo nội bộ — không gửi khách" />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
        Nội bộ — không gửi khách trừ khi đã duyệt ngoại
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {canWrite && (
          <>
            <button
              type="button"
              disabled={busy}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
              onClick={() => void openToday()}
            >
              Mở hôm nay
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-4 py-2 rounded border text-sm disabled:opacity-50"
              onClick={() => void openWeek()}
            >
              Mở tuần này
            </button>
          </>
        )}
        {canWrite && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!token || !backfillYmd) return;
              setBusy(true);
              void backfillIwrReport(token, backfillYmd)
                .then((created) => router.push(`/crm/internal-reports/${created.id}`))
                .catch((err) => setError(err instanceof Error ? err.message : 'Bù ngày thất bại'))
                .finally(() => setBusy(false));
            }}
          >
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={backfillYmd}
              onChange={(e) => setBackfillYmd(e.target.value)}
              aria-label="Bù ngày"
            />
            <button type="submit" className="px-3 py-2 rounded border text-sm" disabled={busy || !backfillYmd}>
              Bù ngày
            </button>
          </form>
        )}
        <Link href="/crm/internal-reports/inbox" className="px-4 py-2 rounded border text-sm">
          Hộp thư
        </Link>
        <Link href="/crm/internal-reports/team" className="px-4 py-2 rounded border text-sm">
          Cây kỳ
        </Link>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tiêu đề</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Kỳ</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/crm/internal-reports/${row.id}`} className="text-blue-600 hover:underline">
                    {row.title}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.template_name_vi}</td>
                <td className="px-3 py-2">
                  {row.period_start}
                  {row.period_end !== row.period_start ? ` — ${row.period_end}` : ''}
                </td>
                <td className="px-3 py-2">{IWR_STATUS_LABELS[row.status]}</td>
                <td className="px-3 py-2">{formatIwrWhen(row.submitted_at)}</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Chưa có báo cáo. {canWrite ? 'Bấm «Mở hôm nay» để bắt đầu.' : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-4">
        Mẫu: {IWR_TEMPLATE_CODES.map((t) => t.label).join(' · ')}
      </p>
    </StaffPageShell>
  );
}
