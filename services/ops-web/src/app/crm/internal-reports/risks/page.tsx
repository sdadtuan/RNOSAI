'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { iwrRelativeVi } from '@/components/crm/iwr/iwr-format';
import { fetchIwrInbox, fetchIwrRisks, type IwrReportRow, type IwrRiskRow } from '@/lib/crm/iwr-api';

const SEV: Record<IwrRiskRow['severity'], string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-700',
};

export default function IwrRisksPage() {
  const { user, token, error, setError, logout, canWrite } = useIwrPageAuth('view');
  const [risks, setRisks] = useState<IwrRiskRow[]>([]);
  const [blockerReports, setBlockerReports] = useState<IwrReportRow[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const [riskOut, inbox] = await Promise.all([
        fetchIwrRisks(token),
        fetchIwrInbox(token, 'blockers').catch(() => ({ items: [] as IwrReportRow[] })),
      ]);
      setRisks((riskOut.items ?? []).filter((r) => r.status !== 'closed'));
      setBlockerReports(inbox.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải blocker thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user} canWrite={canWrite}>
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Blocker & Rủi ro</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <IwrCard>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-semibold">Rủi ro đang mở</h2>
            <span className="rounded-full bg-[#FF5630] px-2 py-0.5 text-[11px] font-semibold text-white">{risks.length}</span>
          </div>
          <ul className="space-y-3">
            {risks.map((r) => (
              <li key={r.id} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SEV[r.severity]}`}>{r.severity}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-slate-400">{r.due_at ? iwrRelativeVi(r.due_at) : 'Chưa có hạn'}</div>
                </div>
                {r.report_id && (
                  <Link href={`/crm/internal-reports/${r.report_id}`} className="text-sm text-[#0052CC]">
                    Xem
                  </Link>
                )}
              </li>
            ))}
            {!risks.length && <li className="text-sm text-slate-400">Không có rủi ro mở</li>}
          </ul>
        </IwrCard>
        <IwrCard>
          <h2 className="mb-4 text-base font-semibold">Báo cáo có blocker</h2>
          <ul className="space-y-3">
            {blockerReports.map((row) => (
              <li key={row.id}>
                <Link href={`/crm/internal-reports/${row.id}`} className="block rounded-lg px-2 py-2 hover:bg-slate-50">
                  <div className="font-medium">{row.title}</div>
                  <div className="text-xs text-slate-400">{row.author_name ?? row.template_name_vi}</div>
                </Link>
              </li>
            ))}
            {!blockerReports.length && <li className="text-sm text-slate-400">Không có báo cáo blocker</li>}
          </ul>
        </IwrCard>
      </div>
    </IwrAppShell>
  );
}
