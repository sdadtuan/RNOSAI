'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { KpiSlaTileGrid } from '@/components/kpi/KpiSlaTileGrid';
import {
  claimLeadSolution,
  fetchKpiSolution,
  fetchSolutionQueue,
  staffMe,
  staffRefresh,
  type KpiSolutionDashboard,
  type SolutionQueueRow,
} from '@/lib/api';
import './solution-queue.css';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';
import {
  solutionQueueHandedAt,
  solutionQueueOwners,
  solutionQueueServiceName,
  solutionQueueShowStage,
  solutionQueueSlaTone,
  solutionQueueStageLabel,
  solutionQueueStatus,
} from '@/lib/crm/solution-queue-display';
import { ActionErrorToast, ActionSuccessToast } from '@/components/ui/ActionToast';

export default function CrmSolutionQueuePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<SolutionQueueRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'with_solution'>('all');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyLeadId, setBusyLeadId] = useState<number | null>(null);
  const [slaTiles, setSlaTiles] = useState<KpiSolutionDashboard | null>(null);
  const solutionCaps = resolvePresalesSolutionCaps(user);
  const aeTrackOnly = solutionCaps.isAeTrackOnly;
  const showStage = solutionQueueShowStage(rows);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_leads', 'view') && !hasCap(me, 'crm_presales_solution', 'view')) {
        setError('Cần quyền xem Solution queue (crm_presales_solution.view hoặc crm_leads.view)');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        const me = await staffMe(out.access_token);
        setUser(me);
        updateStoredUser(me);
        return out.access_token;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await ensureAuth();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const status = filter === 'all' ? undefined : filter;
      const [out, kpiOut] = await Promise.all([
        fetchSolutionQueue(token, { status, limit: 100 }),
        aeTrackOnly ? Promise.resolve(null) : fetchKpiSolution(token).catch(() => null),
      ]);
      setRows(out.rows ?? []);
      setSlaTiles(kpiOut);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hàng chờ Solution thất bại');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [aeTrackOnly, ensureAuth, filter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function onClaim(leadId: number) {
    const token = getAccessToken();
    if (!token) return;
    setBusyLeadId(leadId);
    setMessage('');
    setError('');
    try {
      await claimLeadSolution(token, leadId);
      setMessage(`Đã nhận case Lead #${leadId}`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nhận case thất bại');
    } finally {
      setBusyLeadId(null);
    }
  }

  return (
    <StaffPageShell user={user} onLogout={logout}>
      <PageToolbar
        title={aeTrackOnly ? 'Theo dõi Solution / chỉnh lại' : 'Hàng chờ Solution (AM)'}
        subtitle={
          aeTrackOnly
            ? 'Chỉ lead của bạn: đã chuyển Solution/AM, hoặc AM trả lại cần chỉnh bước trước — chỉ xem, không nhận case.'
            : 'Lead đã Submit to AM — AM làm Solution rồi nộp cho Sales'
        }
      />

      <ActionErrorToast message={error} />
      <ActionSuccessToast message={message} />

      {aeTrackOnly ? (
        <p className="muted" style={{ marginTop: 0 }}>
          Nhận case dành cho Solution-MKT. AE chỉ mở lead để xem hoặc chỉnh bước trước.
        </p>
      ) : (
        <KpiSlaTileGrid data={slaTiles} />
      )}

      {!aeTrackOnly ? (
        <div className="toolbar-row" style={{ marginBottom: '0.75rem' }}>
          <label className="inline-label">
            Lọc
            <select
              className="input input-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">Tất cả (pending + đang xử lý)</option>
              <option value="pending">Chờ nhận</option>
              <option value="with_solution">Đang xử lý</option>
            </select>
          </label>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void loadQueue()} disabled={loading}>
            Làm mới
          </button>
        </div>
      ) : (
        <div className="toolbar-row" style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void loadQueue()} disabled={loading}>
            Làm mới
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="muted">
          {aeTrackOnly
            ? 'Không có lead của bạn đang ở Solution hoặc cần chỉnh sau khi AM trả lại'
            : 'Không có lead chờ tư vấn'}
        </p>
      ) : (
        <div className="sq-wrap" data-testid="solution-queue-list">
          <table className="sq-table">
            <colgroup>
              <col className="sq-col-lead" />
              <col className="sq-col-service" />
              {showStage ? <col className="sq-col-stage" /> : null}
              <col className="sq-col-people" />
              <col className="sq-col-status" />
              <col className="sq-col-time" />
              <col className="sq-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Dịch vụ</th>
                {showStage ? <th>Bước</th> : null}
                <th>Phụ trách</th>
                <th>Trạng thái</th>
                <th>Giao lúc</th>
                <th className="sq-actions-head" />
              </tr>
            </thead>
            <tbody>
          {rows.map((row) => {
            const openHref =
              row.queue_kind === 'am_rework'
                ? `/crm/leads/${row.lead_id}`
                : `/crm/leads/${row.lead_id}#funnel-presales`;
            const canClaim =
              !aeTrackOnly &&
              row.queue_kind !== 'am_rework' &&
              row.handoff_status === 'pending' &&
              solutionCaps.canClaim;
            const owners = solutionQueueOwners(row);
            const status = solutionQueueStatus(row);
            const sla = solutionQueueSlaTone(row);
            const stageLabel = solutionQueueStageLabel(row.presales_stage);
            return (
                  <tr key={`${row.queue_kind ?? 'solution'}-${row.lead_id}`}>
                    <td>
                      <div className="sq-name">{row.full_name?.trim() || '—'}</div>
                      <div className="sq-sub">
                        <Link href={openHref} className="sq-id">#{row.lead_id}</Link>
                        {row.phone?.trim() ? <span> · {row.phone.trim()}</span> : null}
                      </div>
                    </td>
                    <td title={row.service_slug || undefined}>{solutionQueueServiceName(row.service_slug)}</td>
                    {showStage ? <td>{stageLabel || '—'}</td> : null}
                    <td>
                      {owners.length ? owners.map((line) => <div key={line} className="sq-sub">{line}</div>) : '—'}
                    </td>
                    <td>
                      <span className={`sq-badge sq-badge--${status.tone}`}>{status.label}</span>
                      {status.detail ? <div className="sq-sub">{status.detail}</div> : null}
                    </td>
                    <td className={sla ? `sq-time is-${sla}` : 'sq-time'} title={row.handed_off_at || undefined}>
                      {solutionQueueHandedAt(row.handed_off_at)}
                    </td>
                    <td className="sq-actions">
                      {canClaim ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          data-testid="solution-queue-claim"
                          disabled={busyLeadId === row.lead_id}
                          onClick={() => void onClaim(row.lead_id)}
                        >
                          {busyLeadId === row.lead_id ? 'Đang nhận…' : 'Nhận Case'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        data-testid="solution-queue-open"
                        onClick={() => router.push(openHref)}
                      >
                        Mở
                      </button>
                    </td>
                  </tr>
            );
          })}
            </tbody>
          </table>
        </div>
      )}
    </StaffPageShell>
  );
}
