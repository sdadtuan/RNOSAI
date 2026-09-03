'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IwrAppShell, IwrCard } from '@/components/crm/iwr/IwrAppShell';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import { iwrAvatarTone, iwrInitials, iwrIsoWeekLabel, iwrRagClass, iwrRagLabel, iwrRelativeVi } from '@/components/crm/iwr/iwr-format';
import {
  IWR_STATUS_LABELS,
  IWR_TEMPLATE_CODES,
  backfillIwrReport,
  createIwrReport,
  fetchIwrDashboard,
  fetchIwrInbox,
  fetchIwrReports,
  fetchIwrRisks,
  fetchIwrTeam,
  formatIwrWhen,
  type IwrDashLeader,
  type IwrReportRow,
  type IwrRiskRow,
  type IwrTeamNode,
} from '@/lib/crm/iwr-api';

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export default function InternalReportsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const kind = params.get('kind');
  const { user, token, error, setError, logout, canWrite } = useIwrPageAuth('view');
  const [sendOpen, setSendOpen] = useState(false);
  const [items, setItems] = useState<IwrReportRow[]>([]);
  const [actionItems, setActionItems] = useState<IwrReportRow[]>([]);
  const [risks, setRisks] = useState<IwrRiskRow[]>([]);
  const [team, setTeam] = useState<IwrTeamNode[]>([]);
  const [dash, setDash] = useState<IwrDashLeader | null>(null);
  const [busy, setBusy] = useState(false);
  const [backfillYmd, setBackfillYmd] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const week = iwrIsoWeekLabel();

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const query: Record<string, string> = {};
      if (kind === 'daily') query.template_code = 'daily_work';
      if (kind === 'weekly') query.template_code = 'weekly_work';
      const [mine, inbox, riskOut, teamOut, leaderDash] = await Promise.all([
        fetchIwrReports(token, query),
        fetchIwrInbox(token, 'action').catch(() => ({ items: [] as IwrReportRow[] })),
        fetchIwrRisks(token).catch(() => ({ items: [] as IwrRiskRow[] })),
        fetchIwrTeam(token, {
          period_start: week.start,
          period_end: week.end,
          template_code: 'weekly_work',
        }).catch(() => ({ nodes: [] as IwrTeamNode[] })),
        fetchIwrDashboard(token, 'leader').catch(() => null),
      ]);
      setItems(mine.items ?? []);
      setActionItems(inbox.items ?? []);
      setRisks((riskOut.items ?? []).filter((r) => r.status !== 'closed'));
      setTeam(teamOut.nodes ?? []);
      if (leaderDash && typeof leaderDash === 'object' && 'submitted' in leaderDash) {
        setDash(leaderDash as IwrDashLeader);
      } else {
        setDash(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
    }
  }, [token, setError, kind, week.start, week.end]);

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

  const submitted = dash?.submitted ?? items.filter((r) => r.status !== 'draft' && r.status !== 'waived').length;
  const missing = dash?.missing ?? Math.max(0, team.length - submitted);
  const total = submitted + missing || team.length || items.length;
  const late = dash?.late ?? items.filter((r) => r.is_late).length;
  const onTime = Math.max(0, submitted - late);
  const onTimePct = submitted > 0 ? ((onTime / submitted) * 100).toFixed(1).replace('.', ',') : '0';
  const submitPct = total > 0 ? ((submitted / total) * 100).toFixed(1).replace('.', ',') : '0';
  const openBlockers = dash?.open_blockers ?? risks.length;
  const riskProjects = dash?.rag_red ?? team.filter((n) => n.report?.rag === 'red').length;

  const filteredAction = useMemo(() => {
    if (statusFilter === 'all') return actionItems;
    return actionItems.filter((r) => r.status === statusFilter);
  }, [actionItems, statusFilter]);

  const progressRows = useMemo(() => {
    const byName = new Map<string, { green: number; yellow: number; red: number }>();
    for (const n of team) {
      const key = n.name;
      const cur = byName.get(key) ?? { green: 0, yellow: 0, red: 0 };
      if (n.derived === 'acked' || n.derived === 'submitted') cur.green += 1;
      else if (n.derived === 'late' || n.derived === 'draft') cur.yellow += 1;
      else cur.red += 1;
      byName.set(key, cur);
    }
    if (byName.size === 0) {
      for (const r of items.slice(0, 6)) {
        const key = r.author_name ?? r.template_name_vi;
        const cur = byName.get(key) ?? { green: 0, yellow: 0, red: 0 };
        if (r.rag === 'green') cur.green += 1;
        else if (r.rag === 'yellow') cur.yellow += 1;
        else if (r.rag === 'red') cur.red += 1;
        else if (r.status === 'submitted' || r.status === 'acknowledged') cur.green += 1;
        else cur.yellow += 1;
        byName.set(key, cur);
      }
    }
    return Array.from(byName.entries()).slice(0, 6);
  }, [team, items]);

  return (
    <IwrAppShell
      user={user}
      token={token}
      onLogout={logout}
      loading={!user}
      canWrite={canWrite}
      sendOpen={sendOpen}
      onSendOpenChange={setSendOpen}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          {kind === 'daily' ? 'Báo cáo ngày' : kind === 'weekly' ? 'Báo cáo tuần' : 'Tổng quan báo cáo'}
        </h1>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
          {week.label}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canWrite && (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                onClick={() => void openToday()}
              >
                Mở hôm nay
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                onClick={() => void openWeek()}
              >
                + Tạo báo cáo
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#0052CC] px-3 py-2 text-sm font-medium text-white"
                onClick={() => setSendOpen(true)}
              >
                Gửi báo cáo
              </button>
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
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={backfillYmd}
                  onChange={(e) => setBackfillYmd(e.target.value)}
                  aria-label="Bù ngày"
                />
                <button type="submit" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" disabled={busy || !backfillYmd}>
                  Bù ngày
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Nội bộ — không gửi khách trừ khi đã duyệt ngoại
      </div>

      {!kind && (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Kpi
              title="Đã nộp"
              value={total ? `${submitted}/${total}` : String(submitted)}
              sub={`${submitPct}% nhân sự đã nộp`}
              tone="green"
            />
            <Kpi title="Đúng hạn" value={`${onTimePct}%`} sub={`${onTime}/${submitted || 0} báo cáo đúng hạn`} tone="green" />
            <Kpi
              title="Blocker cần xử lý"
              value={String(openBlockers)}
              sub={openBlockers > 0 ? 'Cần xử lý ngay' : 'Không có blocker mở'}
              tone="red"
            />
            <Kpi
              title="Dự án rủi ro"
              value={String(riskProjects)}
              sub={riskProjects > 0 ? 'Cần theo dõi sát' : 'Không có RAG đỏ'}
              tone="amber"
            />
          </div>

          <IwrCard className="mb-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Báo cáo cần xử lý</h2>
              <span className="rounded-full bg-[#0052CC] px-2 py-0.5 text-[11px] font-semibold text-white">
                {filteredAction.length}
              </span>
              <div className="ml-auto flex gap-2">
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="submitted">Đã gửi</option>
                  <option value="supplemented">Đã bổ sung</option>
                  <option value="changes_requested">Cần bổ sung</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 pr-3">Nhân sự</th>
                    <th className="pb-2 pr-3">Tiêu đề báo cáo</th>
                    <th className="pb-2 pr-3">Dự án / Kỳ</th>
                    <th className="pb-2 pr-3">Trạng thái</th>
                    <th className="pb-2 pr-3">Chưa đọc</th>
                    <th className="pb-2 pr-3">Thời gian</th>
                    <th className="pb-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAction.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${iwrAvatarTone(row.author_staff_id)}`}>
                            {iwrInitials(row.author_name)}
                          </span>
                          <div>
                            <div className="font-medium">{row.author_name ?? `#${row.author_staff_id}`}</div>
                            <div className="text-[11px] text-slate-400">{row.template_name_vi}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium">{row.title}</div>
                        <div className="text-[11px] text-slate-400">{formatIwrWhen(row.submitted_at)}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {row.period_start}
                        {row.period_end !== row.period_start ? ` — ${row.period_end}` : ''}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${iwrRagClass(row.rag)}`}>
                          {iwrRagLabel(row.rag)}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        {!row.first_viewed_at ? <span className="inline-block h-2 w-2 rounded-full bg-[#0052CC]" /> : '—'}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-500">{iwrRelativeVi(row.submitted_at)}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Link href={`/crm/internal-reports/${row.id}`} className="text-[#0052CC] hover:underline">
                            Xem
                          </Link>
                          <Link href={`/crm/internal-reports/${row.id}`} className="text-slate-500 hover:underline">
                            Phản hồi
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredAction.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Không có báo cáo cần xử lý
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Link href="/crm/internal-reports/inbox" className="mt-4 inline-block text-sm text-[#0052CC] hover:underline">
              Xem tất cả báo cáo →
            </Link>
          </IwrCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <IwrCard>
              <h2 className="mb-4 text-base font-semibold">Tiến độ dự án</h2>
              <div className="mb-3 flex gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Đúng tiến độ</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-amber-400" /> Chậm</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Rủi ro</span>
              </div>
              <div className="space-y-3">
                {progressRows.map(([name, v]) => {
                  const sum = v.green + v.yellow + v.red || 1;
                  return (
                    <div key={name}>
                      <div className="mb-1 truncate text-xs text-slate-600">{name}</div>
                      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                        <span className="bg-emerald-500" style={{ width: `${(v.green / sum) * 100}%` }} />
                        <span className="bg-amber-400" style={{ width: `${(v.yellow / sum) * 100}%` }} />
                        <span className="bg-red-500" style={{ width: `${(v.red / sum) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!progressRows.length && <p className="text-sm text-slate-400">Chưa có dữ liệu kỳ này</p>}
              </div>
            </IwrCard>
            <IwrCard>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-base font-semibold">Blocker khẩn cấp</h2>
                <span className="rounded-full bg-[#FF5630] px-2 py-0.5 text-[11px] font-semibold text-white">{risks.length}</span>
              </div>
              <ul className="space-y-3">
                {risks.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-start gap-3">
                    <span className="mt-0.5 text-red-500">⚠</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-slate-400">
                        {r.severity === 'critical' || r.severity === 'high' ? 'Ưu tiên cao' : 'Ưu tiên trung bình'}
                        {r.due_at ? ` · ${iwrRelativeVi(r.due_at)}` : ''}
                      </div>
                    </div>
                    {r.report_id && (
                      <Link href={`/crm/internal-reports/${r.report_id}`} className="text-xs text-[#0052CC]">
                        Xem
                      </Link>
                    )}
                  </li>
                ))}
                {!risks.length && <li className="text-sm text-slate-400">Không có blocker mở</li>}
              </ul>
            </IwrCard>
          </div>
        </>
      )}

      {kind && (
        <IwrCard>
          <MyReportsTable items={items} canWrite={canWrite} />
        </IwrCard>
      )}

      <p className="mt-4 text-xs text-slate-400">Mẫu: {IWR_TEMPLATE_CODES.map((t) => t.label).join(' · ')}</p>
    </IwrAppShell>
  );
}

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub: string; tone: 'green' | 'red' | 'amber' }) {
  const icon =
    tone === 'green' ? 'bg-emerald-50 text-emerald-600' : tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600';
  return (
    <IwrCard>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className={`mt-1 text-2xl font-semibold ${tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>
            {value}
          </div>
          <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${icon}`}>●</span>
      </div>
    </IwrCard>
  );
}

function MyReportsTable({ items, canWrite }: { items: IwrReportRow[]; canWrite: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="pb-2 pr-3">Tiêu đề</th>
            <th className="pb-2 pr-3">Loại</th>
            <th className="pb-2 pr-3">Kỳ</th>
            <th className="pb-2 pr-3">Trạng thái</th>
            <th className="pb-2">Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="py-3 pr-3">
                <Link href={`/crm/internal-reports/${row.id}`} className="text-[#0052CC] hover:underline">
                  {row.title}
                </Link>
              </td>
              <td className="py-3 pr-3">{row.template_name_vi}</td>
              <td className="py-3 pr-3">
                {row.period_start}
                {row.period_end !== row.period_start ? ` — ${row.period_end}` : ''}
              </td>
              <td className="py-3 pr-3">{IWR_STATUS_LABELS[row.status]}</td>
              <td className="py-3">{formatIwrWhen(row.submitted_at)}</td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate-400">
                Chưa có báo cáo. {canWrite ? 'Bấm «Mở hôm nay» để bắt đầu.' : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
