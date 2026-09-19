'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  fetchRoleKpiList,
  patchRoleKpiStatus,
  type RoleKpiRow,
} from '@/lib/kpi-hub-api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
} from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

const ROLES = ['am', 'graphic', 'content', 'video', 'ads', 'pm'];
const STATUSES = ['draft', 'review', 'approved', 'locked', 'cancelled'];

export default function RoleKpiPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [rows, setRows] = useState<RoleKpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<RoleKpiRow | null>(null);

  const planId = search.get('plan_id') ?? '';
  const roleKey = search.get('role_key') ?? '';
  const status = search.get('status') ?? '';

  const user = getStoredUser();
  const canManage = Boolean(
    user &&
      (hasCap(user, 'crm_kpi_hub_targets', 'manage') ||
        hasCap(user, 'crm_kpi_hub', 'manage') ||
        hasCap(user, 'ai_admin', 'configure')),
  );
  const canApprove = Boolean(
    user &&
      (hasCap(user, 'crm_kpi_hub_targets', 'manage') ||
        hasCap(user, 'crm_kpi_hub_reports', 'approve') ||
        hasCap(user, 'crm_kpi_hub', 'manage') ||
        hasCap(user, 'ai_admin', 'configure')),
  );

  const load = useCallback(async () => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await fetchRoleKpiList(token, {
        plan_id: planId || undefined,
        role_key: roleKey || undefined,
        status: status || undefined,
      });
      setRows(out.data ?? []);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        token = out.access_token;
        const data = await fetchRoleKpiList(token, {
          plan_id: planId || undefined,
          role_key: roleKey || undefined,
          status: status || undefined,
        });
        setRows(data.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Role KPI thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [planId, roleKey, status, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/crm/kpi-hub/role-kpi?${next.toString()}`);
  };

  async function transition(id: number, nextStatus: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(id);
    setError('');
    try {
      await patchRoleKpiStatus(token, id, nextStatus);
      await load();
      setSelected((prev) => (prev?.id === id ? { ...prev, status: nextStatus } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại');
    } finally {
      setBusyId(null);
    }
  }

  const emptyHint = useMemo(() => {
    if (!planId) return 'Chưa có Role KPI. Lọc theo plan_id hoặc chạy plan.breakdown_to_roles với persist_kpis=true.';
    return `Plan #${planId} chưa có Role KPI draft. Chạy breakdown (persist_kpis) hoặc Try tool kpi_target.write_draft.`;
  }, [planId]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Role KPI"
        subtitle="Target KPI theo chức danh (AM / Graphic / Content / Video / Ads / PM). AI chỉ ghi draft — không set actual, không tự duyệt."
        breadcrumb={[{ label: 'Tổng quan' }, { label: 'Role KPI' }]}
      >
        <div data-testid="role-kpi-page" style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Plan ID</span>
              <input
                value={planId}
                onChange={(e) => setFilter('plan_id', e.target.value.trim())}
                placeholder="8"
                style={{ minWidth: 100 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Role</span>
              <select value={roleKey} onChange={(e) => setFilter('role_key', e.target.value)}>
                <option value="">Tất cả</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Status</span>
              <select value={status} onChange={(e) => setFilter('status', e.target.value)}>
                <option value="">Tất cả</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={() => void load()}>
              Tải lại
            </button>
            {planId ? (
              <Link className="kpi-hub-btn kpi-hub-btn--ghost" href={`/crm/marketing-plan/${planId}`}>
                Mở plan #{planId}
              </Link>
            ) : null}
          </div>

          {loading ? <p className="muted">Đang tải…</p> : null}
          {error ? <p className="error">{error}</p> : null}

          {!loading && rows.length === 0 ? (
            <div className="kpi-hub-empty">
              <p>{emptyHint}</p>
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                Try tool: <code>plan.breakdown_to_roles</code> với{' '}
                <code>{'{"plan_id":8,"persist_kpis":true}'}</code> + Human approved.
              </p>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="kpi-hub-table" data-testid="role-kpi-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>KPI</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Unit</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Plan</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.role_key}</td>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => setSelected(row)}
                          style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {row.kpi_label || row.kpi_key}
                        </button>
                      </td>
                      <td>{row.target_value == null ? '—' : row.target_value}</td>
                      <td>{row.actual_value == null ? '—' : row.actual_value}</td>
                      <td>{row.target_unit}</td>
                      <td>
                        {row.period_start ?? '—'} → {row.period_end ?? '—'}
                      </td>
                      <td>{row.status}</td>
                      <td>
                        {row.plan_id != null ? (
                          <Link href={`/crm/marketing-plan/${row.plan_id}`}>#{row.plan_id}</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {row.status === 'draft' && canManage ? (
                          <button
                            type="button"
                            className="kpi-hub-btn kpi-hub-btn--ghost"
                            disabled={busyId === row.id}
                            onClick={() => void transition(row.id, 'review')}
                          >
                            Gửi review
                          </button>
                        ) : null}
                        {row.status === 'review' && canApprove ? (
                          <button
                            type="button"
                            className="kpi-hub-btn kpi-hub-btn--primary"
                            disabled={busyId === row.id}
                            onClick={() => void transition(row.id, 'approved')}
                          >
                            Approve
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {selected ? (
            <aside
              data-testid="role-kpi-drawer"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '1rem',
                background: 'var(--panel, var(--bg))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {selected.kpi_label} · {selected.role_key}
                </h3>
                <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={() => setSelected(null)}>
                  Đóng
                </button>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                Status: <strong>{selected.status}</strong> · Target:{' '}
                {selected.target_value == null ? 'unknown' : selected.target_value} {selected.target_unit}
              </p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{selected.notes || '—'}</p>
              {selected.form_data?.ai_draft ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  AI draft bởi {String(selected.form_data.ai_approved_by ?? '—')} ·{' '}
                  {String(selected.form_data.ai_approved_at ?? '')}
                </p>
              ) : null}
              {selected.lifecycle_id != null ? (
                <p>
                  <Link href={`/crm/service-delivery/${selected.lifecycle_id}`}>
                    Lifecycle #{selected.lifecycle_id}
                  </Link>
                </p>
              ) : null}
            </aside>
          ) : null}
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
