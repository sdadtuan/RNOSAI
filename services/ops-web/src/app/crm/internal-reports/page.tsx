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
      <div className="iwr-pagehead">
        <h1 className="iwr-h1">
          {kind === 'daily' ? 'Báo cáo ngày' : kind === 'weekly' ? 'Báo cáo tuần' : 'Tổng quan báo cáo'}
        </h1>
        <span className="iwr-chip">{week.label}</span>
        <div className="iwr-pagehead__actions">
          {canWrite && (
            <>
              <button type="button" disabled={busy} className="iwr-btn" onClick={() => void openToday()}>
                Mở hôm nay
              </button>
              <button type="button" disabled={busy} className="iwr-btn" onClick={() => void openWeek()}>
                + Tạo báo cáo
              </button>
              <button type="button" className="iwr-btn iwr-btn--primary" onClick={() => setSendOpen(true)}>
                Gửi báo cáo
              </button>
              <form
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
                  className="iwr-input"
                  value={backfillYmd}
                  onChange={(e) => setBackfillYmd(e.target.value)}
                  aria-label="Bù ngày"
                />
                <button type="submit" className="iwr-btn" disabled={busy || !backfillYmd}>
                  Bù ngày
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {error && <p className="iwr-err">{error}</p>}
      <div className="iwr-notice">Nội bộ — không gửi khách trừ khi đã duyệt ngoại</div>

      {!kind && (
        <>
          <div className="iwr-kpis">
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

          <IwrCard>
            <div className="iwr-cardhead">
              <h2>Báo cáo cần xử lý</h2>
              <span className="iwr-badge">{filteredAction.length}</span>
              <select className="iwr-input" style={{ width: 'auto', marginLeft: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="submitted">Đã gửi</option>
                <option value="supplemented">Đã bổ sung</option>
                <option value="changes_requested">Cần bổ sung</option>
              </select>
            </div>
            <table className="iwr-table">
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Tiêu đề báo cáo</th>
                  <th>Dự án / Kỳ</th>
                  <th>Trạng thái</th>
                  <th>Chưa đọc</th>
                  <th>Thời gian</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAction.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="iwr-person">
                        <span className={iwrAvatarTone(row.author_staff_id)}>{iwrInitials(row.author_name)}</span>
                        <div>
                          <div>{row.author_name ?? `#${row.author_staff_id}`}</div>
                          <div className="iwr-muted">{row.template_name_vi}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{row.title}</div>
                      <div className="iwr-muted">{formatIwrWhen(row.submitted_at)}</div>
                    </td>
                    <td>
                      {row.period_start}
                      {row.period_end !== row.period_start ? ` — ${row.period_end}` : ''}
                    </td>
                    <td>
                      <span className={iwrRagClass(row.rag)}>{iwrRagLabel(row.rag)}</span>
                    </td>
                    <td>{!row.first_viewed_at ? <span className="iwr-dot" /> : '—'}</td>
                    <td className="iwr-muted">{iwrRelativeVi(row.submitted_at)}</td>
                    <td>
                      <Link href={`/crm/internal-reports/${row.id}`} className="iwr-link">
                        Xem
                      </Link>
                      {' · '}
                      <Link href={`/crm/internal-reports/${row.id}`} className="iwr-link">
                        Phản hồi
                      </Link>
                    </td>
                  </tr>
                ))}
                {!filteredAction.length && (
                  <tr>
                    <td colSpan={7} className="iwr-empty">
                      Không có báo cáo cần xử lý
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Link href="/crm/internal-reports/inbox" className="iwr-link">
              Xem tất cả báo cáo →
            </Link>
          </IwrCard>

          <div className="iwr-split">
            <IwrCard>
              <h2>Tiến độ dự án</h2>
              <div className="iwr-legend">
                <span><i style={{ background: '#36b37e' }} /> Đúng tiến độ</span>
                <span><i style={{ background: '#ffab00' }} /> Chậm</span>
                <span><i style={{ background: '#ff5630' }} /> Rủi ro</span>
              </div>
              {progressRows.map(([name, v]) => {
                const sum = v.green + v.yellow + v.red || 1;
                return (
                  <div key={name} style={{ marginBottom: 12 }}>
                    <div className="iwr-muted">{name}</div>
                    <div className="iwr-bar">
                      <span style={{ width: `${(v.green / sum) * 100}%`, background: '#36b37e' }} />
                      <span style={{ width: `${(v.yellow / sum) * 100}%`, background: '#ffab00' }} />
                      <span style={{ width: `${(v.red / sum) * 100}%`, background: '#ff5630' }} />
                    </div>
                  </div>
                );
              })}
              {!progressRows.length && <p className="iwr-empty">Chưa có dữ liệu kỳ này</p>}
            </IwrCard>
            <IwrCard>
              <div className="iwr-cardhead">
                <h2>Blocker khẩn cấp</h2>
                <span className="iwr-badge iwr-badge--danger">{risks.length}</span>
              </div>
              <ul>
                {risks.slice(0, 5).map((r) => (
                  <li key={r.id} style={{ marginBottom: 12 }}>
                    <strong>{r.title}</strong>
                    <div className="iwr-muted">
                      {r.severity === 'critical' || r.severity === 'high' ? 'Ưu tiên cao' : 'Ưu tiên trung bình'}
                      {r.due_at ? ` · ${iwrRelativeVi(r.due_at)}` : ''}
                    </div>
                    {r.report_id && (
                      <Link href={`/crm/internal-reports/${r.report_id}`} className="iwr-link">
                        Xem
                      </Link>
                    )}
                  </li>
                ))}
                {!risks.length && <li className="iwr-empty">Không có blocker mở</li>}
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

      <p className="iwr-muted">Mẫu: {IWR_TEMPLATE_CODES.map((t) => t.label).join(' · ')}</p>
    </IwrAppShell>
  );
}

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub: string; tone: 'green' | 'red' | 'amber' }) {
  return (
    <IwrCard>
      <div className="iwr-kpi__label">{title}</div>
      <div className={`iwr-kpi__value${tone === 'red' ? ' is-red' : tone === 'amber' ? ' is-amber' : ''}`}>{value}</div>
      <div className="iwr-kpi__sub">{sub}</div>
    </IwrCard>
  );
}

function MyReportsTable({ items, canWrite }: { items: IwrReportRow[]; canWrite: boolean }) {
  return (
    <table className="iwr-table">
      <thead>
        <tr>
          <th>Tiêu đề</th>
          <th>Loại</th>
          <th>Kỳ</th>
          <th>Trạng thái</th>
          <th>Cập nhật</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id}>
            <td>
              <Link href={`/crm/internal-reports/${row.id}`} className="iwr-link">
                {row.title}
              </Link>
            </td>
            <td>{row.template_name_vi}</td>
            <td>
              {row.period_start}
              {row.period_end !== row.period_start ? ` — ${row.period_end}` : ''}
            </td>
            <td>{IWR_STATUS_LABELS[row.status]}</td>
            <td>{formatIwrWhen(row.submitted_at)}</td>
          </tr>
        ))}
        {!items.length && (
          <tr>
            <td colSpan={5} className="iwr-empty">
              Chưa có báo cáo. {canWrite ? 'Bấm «Mở hôm nay» để bắt đầu.' : ''}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
