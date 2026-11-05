'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  fetchRoleKpiList,
  patchRoleKpiFields,
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
import { ApiError, staffRefresh } from '@/lib/api';

const ROLES = ['am', 'graphic', 'content', 'video', 'ads', 'pm'];
const STATUSES = ['draft', 'review', 'approved', 'locked', 'cancelled'];

async function withAuthRetry<T>(fn: (token: string) => Promise<T>): Promise<T> {
  let token = getAccessToken();
  if (!token) throw new ApiError('Unauthorized', 401);
  try {
    return await fn(token);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const refresh = getRefreshToken();
    if (!refresh) throw err;
    const out = await staffRefresh(refresh);
    updateAccessToken(out.access_token);
    return fn(out.access_token);
  }
}

export default function RoleKpiPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [rows, setRows] = useState<RoleKpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<RoleKpiRow | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editBusy, setEditBusy] = useState(false);

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
    if (!getAccessToken() && !getRefreshToken()) {
      clearSession();
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await withAuthRetry((token) =>
        fetchRoleKpiList(token, {
          plan_id: planId || undefined,
          role_key: roleKey || undefined,
          status: status || undefined,
        }),
      );
      setRows(out.data ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Tải Role KPI thất bại');
    } finally {
      setLoading(false);
    }
  }, [planId, roleKey, status, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function openDrawer(row: RoleKpiRow) {
    setSelected(row);
    setEditTarget(row.target_value == null ? '' : String(row.target_value));
    setEditOwner(row.owner_staff_id ?? '');
    setEditDue(row.period_end ?? '');
  }

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/crm/kpi-hub/role-kpi?${next.toString()}`);
  };

  async function transition(id: number, nextStatus: string) {
    setBusyId(id);
    setError('');
    try {
      await withAuthRetry((token) => patchRoleKpiStatus(token, id, nextStatus));
      await load();
      setSelected((prev) => (prev?.id === id ? { ...prev, status: nextStatus } : prev));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit() {
    if (!selected || !canManage) return;
    setEditBusy(true);
    setError('');
    try {
      const targetRaw = editTarget.trim();
      const target_value =
        targetRaw === '' ? null : Number.isFinite(Number(targetRaw)) ? Number(targetRaw) : null;
      const out = await withAuthRetry((token) =>
        patchRoleKpiFields(token, selected.id, {
          target_value,
          owner_staff_id: editOwner.trim() || null,
          due_date: editDue.trim() || null,
        }),
      );
      setSelected(out.data);
      setEditTarget(out.data.target_value == null ? '' : String(out.data.target_value));
      setEditOwner(out.data.owner_staff_id ?? '');
      setEditDue(out.data.period_end ?? '');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Lưu Role KPI thất bại');
    } finally {
      setEditBusy(false);
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
                    <th>Owner</th>
                    <th>Due</th>
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
                          onClick={() => openDrawer(row)}
                          style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {row.kpi_label || row.kpi_key}
                        </button>
                      </td>
                      <td>{row.target_value == null ? '—' : row.target_value}</td>
                      <td>{row.actual_value == null ? '—' : row.actual_value}</td>
                      <td>{row.target_unit}</td>
                      <td>{row.owner_staff_id || '—'}</td>
                      <td>{row.period_end || '—'}</td>
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
                        {(row.status === 'draft' || row.status === 'review') && canManage ? (
                          <button
                            type="button"
                            className="kpi-hub-btn kpi-hub-btn--ghost"
                            onClick={() => openDrawer(row)}
                          >
                            Sửa
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
                display: 'grid',
                gap: '0.75rem',
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
              <p className="muted" style={{ margin: 0 }}>
                Status: <strong>{selected.status}</strong>
                {selected.period_start ? ` · Period start ${selected.period_start}` : ''}
              </p>

              {canManage && (selected.status === 'draft' || selected.status === 'review') ? (
                <form
                  data-testid="role-kpi-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveEdit();
                  }}
                  style={{ display: 'grid', gap: '0.65rem' }}
                >
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span className="muted">Target</span>
                    <input
                      type="number"
                      step="any"
                      value={editTarget}
                      onChange={(e) => setEditTarget(e.target.value)}
                      placeholder="Để trống = unknown"
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span className="muted">Owner</span>
                    <input
                      type="text"
                      value={editOwner}
                      onChange={(e) => setEditOwner(e.target.value)}
                      placeholder="Staff id hoặc tên"
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span className="muted">Due (period end)</span>
                    <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                  </label>
                  <button
                    type="submit"
                    className="kpi-hub-btn kpi-hub-btn--primary"
                    disabled={editBusy}
                    style={{ justifySelf: 'start' }}
                  >
                    {editBusy ? 'Đang lưu…' : 'Lưu target / owner / due'}
                  </button>
                </form>
              ) : (
                <p style={{ margin: 0 }}>
                  Target: {selected.target_value == null ? 'unknown' : selected.target_value}{' '}
                  {selected.target_unit}
                  <br />
                  Owner: {selected.owner_staff_id || '—'}
                  <br />
                  Due: {selected.period_end || '—'}
                </p>
              )}

              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selected.notes || '—'}</p>
              {selected.form_data?.ai_draft ? (
                <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                  AI draft bởi {String(selected.form_data.ai_approved_by ?? '—')} ·{' '}
                  {String(selected.form_data.ai_approved_at ?? '')}
                </p>
              ) : null}
              {selected.lifecycle_id != null ? (
                <p style={{ margin: 0 }}>
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
