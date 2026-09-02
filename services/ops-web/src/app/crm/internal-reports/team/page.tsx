'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { fetchIwrTeam, iwrDerivedLabel, type IwrTeamNode } from '@/lib/crm/iwr-api';

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export default function IwrTeamPage() {
  const { user, token, error, setError, logout } = useIwrPageAuth('view');
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
    <StaffPageShell user={user ?? null} onLogout={logout} loading={!user}>
      <PageToolbar title="Cây kỳ" subtitle="Theo dõi nộp báo cáo theo nhóm" />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
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
        <button type="button" className="px-3 py-2 border rounded text-sm" onClick={() => void reload()}>
          Làm mới
        </button>
        <Link href="/crm/internal-reports" className="px-3 py-2 border rounded text-sm">
          Về danh sách
        </Link>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Nhân viên</th>
              <th className="px-3 py-2">Trạng thái kỳ</th>
              <th className="px-3 py-2">Báo cáo</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id} className="border-t">
                <td className="px-3 py-2">{n.name}</td>
                <td className="px-3 py-2">{iwrDerivedLabel(n.derived)}</td>
                <td className="px-3 py-2">
                  {n.report ? (
                    <Link href={`/crm/internal-reports/${n.report.id}`} className="text-blue-600 hover:underline">
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
    </StaffPageShell>
  );
}
