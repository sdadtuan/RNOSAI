'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  exportStaffPermissionPosition,
  fetchStaffPermissionAudit,
  fetchStaffPermissionPosition,
  fetchStaffPermissionPositions,
  patchStaffPermissionPosition,
  staffMe,
  staffRefresh,
  type StaffPermissionAuditRow,
  type StaffPermissionMatrixRow,
  type StaffPermissionPositionDetail,
  type StaffPermissionPositionSummary,
} from '@/lib/api';
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

const ACTION_LABELS: Record<string, string> = {
  view: 'Xem',
  edit: 'Sửa',
  create: 'Tạo',
  delete: 'Xóa',
  export: 'Xuất',
  configure: 'Cấu hình',
  approve: 'Duyệt',
  claim: 'Nhận case',
  release: 'Trả Sales',
  write: 'Ghi',
  settings: 'Cài đặt',
  compliance: 'Tuân thủ',
  deliverability: 'Deliverability',
  reports: 'Báo cáo',
  assign: 'Phân công',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function grantsFromDetail(detail: StaffPermissionPositionDetail): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(detail.grants).map(([k, v]) => [k, [...v].sort()]),
  );
}

export default function AdminCrmPermissionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [positions, setPositions] = useState<StaffPermissionPositionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<StaffPermissionMatrixRow[]>([]);
  const [grants, setGrants] = useState<Record<string, string[]>>({});
  const [audit, setAudit] = useState<StaffPermissionAuditRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

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
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setError('Không có quyền xem ma trận phân quyền (crm_data_config.view)');
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
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const loadPosition = useCallback(async (access: string, positionId: number) => {
    const detail = await fetchStaffPermissionPosition(access, positionId);
    setMatrix(detail.matrix);
    setGrants(grantsFromDetail(detail));
    const auditRows = await fetchStaffPermissionAudit(access, { position_id: positionId, limit: 20 });
    setAudit(auditRows);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const rows = await fetchStaffPermissionPositions(access);
        setPositions(rows);
        if (rows.length) {
          const firstId = rows[0].id;
          setSelectedId(firstId);
          await loadPosition(access, firstId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải ma trận phân quyền thất bại');
      }
    })();
  }, [ensureAuth, loadPosition]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, StaffPermissionMatrixRow[]>();
    for (const row of matrix) {
      const list = groups.get(row.group) ?? [];
      list.push(row);
      groups.set(row.group, list);
    }
    return [...groups.entries()];
  }, [matrix]);

  const selectedPosition = positions.find((p) => p.id === selectedId) ?? null;

  function isAllowed(sectionId: string, action: string): boolean {
    return (grants[sectionId] ?? []).includes(action);
  }

  function toggleCap(sectionId: string, action: string, checked: boolean) {
    setGrants((prev) => {
      const next = { ...prev };
      const current = new Set(next[sectionId] ?? []);
      if (checked) current.add(action);
      else current.delete(action);
      if (current.size) next[sectionId] = [...current].sort();
      else delete next[sectionId];
      return next;
    });
  }

  async function handlePositionChange(positionId: number) {
    const access = getAccessToken();
    if (!access) return;
    setSelectedId(positionId);
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await loadPosition(access, positionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải chức vụ thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const access = getAccessToken();
    if (!access || !canConfigure || selectedId == null) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await patchStaffPermissionPosition(access, selectedId, { grants });
      const refresh = getRefreshToken();
      if (refresh) {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        const me = await staffMe(out.access_token);
        setUser(me);
        updateStoredUser(me);
      }
      await loadPosition(access, selectedId);
      setMsg('Đã lưu ma trận phân quyền — refresh token để áp dụng caps mới');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu ma trận thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    const access = getAccessToken();
    if (!access || selectedId == null) return;
    setBusy(true);
    setError('');
    try {
      const data = await exportStaffPermissionPosition(access, selectedId);
      const blob = new Blob([String(data.markdown ?? JSON.stringify(data, null, 2))], {
        type: 'text/markdown;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rbac-${data.position_code ?? selectedId}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Đã xuất ma trận (Markdown)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xuất ma trận thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell
        user={null}
        onLogout={logout}
        section="crm-config"
        title="Ma trận phân quyền"
        subtitle="Quản lý caps theo chức vụ trên PostgreSQL (R1-S3)"
        loading
      >
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Ma trận phân quyền"
      subtitle="Quản lý caps theo chức vụ trên PostgreSQL — mọi thay đổi được ghi audit"
      actions={
        <div className="toolbar-actions">
          <button type="button" className="btn btn--secondary" disabled={busy || selectedId == null} onClick={() => void handleExport()}>
            Xuất MD
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || !canConfigure || selectedId == null} onClick={() => void handleSave()}>
            Lưu ma trận
          </button>
        </div>
      }
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <div className="kpi-page__filters">
          <label className="muted">
            Chức vụ
            <select
              value={selectedId ?? ''}
              disabled={busy}
              onChange={(e) => void handlePositionChange(Number(e.target.value))}
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                  {p.grants_customized ? ' (đã tùy chỉnh)' : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedPosition ? (
            <span className="muted">
              position_id={selectedPosition.id}
              {selectedPosition.grants_customized ? ' · grants_customized' : ' · default/migrated'}
            </span>
          ) : null}
        </div>

        {!canConfigure ? (
          <p className="muted">Chế độ chỉ xem — cần quyền crm_data_config.configure để lưu.</p>
        ) : null}

        {groupedRows.map(([group, rows]) => (
          <section key={group} className="stack-gap">
            <h3 className="section-title">{group}</h3>
            <div className="table-scroll">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Section / Nút UI</th>
                    <th>Trang</th>
                    {['view', 'edit', 'create', 'delete', 'export', 'configure', 'approve', 'claim', 'release', 'write', 'settings', 'compliance', 'deliverability', 'reports', 'assign'].map(
                      (action) => (
                        <th key={action}>{actionLabel(action)}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.section_id}>
                      <td>
                        <div>{row.row_kind === 'ui_button' ? '↳ ' : ''}{row.section_label}</div>
                        <div className="muted" style={{ fontSize: '0.85em' }}>{row.section_id}</div>
                      </td>
                      <td className="muted">{row.page}</td>
                      {['view', 'edit', 'create', 'delete', 'export', 'configure', 'approve', 'claim', 'release', 'write', 'settings', 'compliance', 'deliverability', 'reports', 'assign'].map(
                        (action) => {
                          if (!row.actions.includes(action)) {
                            return <td key={action} className="muted">—</td>;
                          }
                          const checked = isAllowed(row.section_id, action);
                          return (
                            <td key={action}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canConfigure || busy}
                                aria-label={`${row.section_id}.${action}`}
                                onChange={(e) => toggleCap(row.section_id, action, e.target.checked)}
                              />
                            </td>
                          );
                        },
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="stack-gap">
          <h3 className="section-title">Audit log (20 gần nhất)</h3>
          {audit.length === 0 ? (
            <p className="muted">Chưa có bản ghi audit cho chức vụ này.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Actor</th>
                    <th>Thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => {
                    const diff = row.diff_json as { added?: unknown[]; removed?: unknown[] };
                    return (
                      <tr key={row.id}>
                        <td>{new Date(row.created_at).toLocaleString('vi-VN')}</td>
                        <td>{row.actor_email || '—'}</td>
                        <td className="muted">
                          +{(diff.added ?? []).length} / -{(diff.removed ?? []).length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}
