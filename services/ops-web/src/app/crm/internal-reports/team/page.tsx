'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { iwrAvatarTone, iwrInitials } from '@/components/crm/iwr/iwr-format';
import { fetchIwrTeam, iwrDerivedLabel, type IwrTeamNode } from '@/lib/crm/iwr-api';

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export default function IwrTeamPage() {
  const { user, token, error, setError, logout, canWrite } = useIwrPageAuth('view');
  const [periodStart, setPeriodStart] = useState(todayYmd());
  const [periodEnd, setPeriodEnd] = useState(todayYmd());
  const [templateCode, setTemplateCode] = useState('daily_work');
  const [nodes, setNodes] = useState<IwrTeamNode[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchIwrTeam(token, {
        period_start: periodStart,
        period_end: periodEnd,
        template_code: templateCode,
      });
      setNodes(out.nodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải cây kỳ thất bại');
    }
  }, [token, periodStart, periodEnd, templateCode, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user} canWrite={canWrite}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Dự án / Cây kỳ</h1>
      <p className="mb-5 text-sm text-slate-500">Theo dõi nộp báo cáo theo nhóm</p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Từ
          <input
            type="date"
            className="block border rounded px-2 py-1 mt-1"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Đến
          <input
            type="date"
            className="block border rounded px-2 py-1 mt-1"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Mẫu
          <select
            className="block border rounded px-2 py-1 mt-1"
            value={templateCode}
            onChange={(e) => setTemplateCode(e.target.value)}
          >
            <option value="daily_work">Ngày</option>
            <option value="weekly_work">Tuần</option>
            <option value="monthly_work">Tháng</option>
          </select>
        </label>
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onClick={() => void reload()}>
          Làm mới
        </button>
        <Link href="/crm/internal-reports" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          Về danh sách
        </Link>
      </div>
      <IwrCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-3">Nhân viên</th>
                <th className="pb-2 pr-3">Trạng thái kỳ</th>
                <th className="pb-2">Báo cáo</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id} className="border-t border-slate-100">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${iwrAvatarTone(n.id)}`}>
                        {iwrInitials(n.name)}
                      </span>
                      {n.name}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{iwrDerivedLabel(n.derived)}</td>
                  <td className="py-3">
                    {n.report ? (
                      <Link href={`/crm/internal-reports/${n.report.id}`} className="text-[#0052CC] hover:underline">
                        Mở
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </IwrCard>
    </IwrAppShell>
  );
}
