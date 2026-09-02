'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { hasCap } from '@/lib/auth';
import {
  fetchCsdChatAccountsAdmin,
  upsertCsdChatAccount,
  type CsdChatAccountAdminRow,
} from '@/lib/crm/csd-api';

export default function AdminCsdChatAccountsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth((u) => hasCap(u, 'csd', 'admin'));
  const [rows, setRows] = useState<CsdChatAccountAdminRow[]>([]);
  const [q, setQ] = useState('');
  const [staffId, setStaffId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [msg, setMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (access: string, query?: string) => {
      const out = await fetchCsdChatAccountsAdmin(access, query);
      setRows(out.items ?? []);
    },
    [],
  );

  useEffect(() => {
    if (!token) return;
    void reload(token, q).catch((err) => {
      setFormError(err instanceof Error ? err.message : 'Không tải được danh sách');
    });
  }, [token, q, reload]);

  async function toggle(row: CsdChatAccountAdminRow) {
    if (!token) return;
    setBusy(true);
    setFormError('');
    setMsg('');
    try {
      await upsertCsdChatAccount(token, { staff_id: row.staff_id, enabled: !row.enabled });
      await reload(token, q);
      setMsg(row.enabled ? `Đã tắt staff #${row.staff_id}` : `Đã bật staff #${row.staff_id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function enableNew(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const id = Number(staffId);
    if (!Number.isInteger(id) || id <= 0) {
      setFormError('Nhập staff id hợp lệ');
      return;
    }
    setBusy(true);
    setFormError('');
    setMsg('');
    try {
      await upsertCsdChatAccount(token, {
        staff_id: id,
        enabled: true,
        display_name_vi: displayName.trim() || undefined,
      });
      setStaffId('');
      setDisplayName('');
      await reload(token, q);
      setMsg(`Đã bật tài khoản chat cho staff #${id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Bật tài khoản thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Tài khoản Chat"
      subtitle="Chỉ Admin cấp. Nhân viên đăng nhập /login — không tự đăng ký."
      loading={loading}
    >
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="muted">{msg}</p> : null}
      {formError ? <p className="error">{formError}</p> : null}

      <form className="csd-chat-account-form" onSubmit={(e) => void enableNew(e)}>
        <input
          className="kpi-input"
          inputMode="numeric"
          placeholder="Staff id"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          data-testid="csd-chat-account-staff-id"
        />
        <input
          className="kpi-input"
          placeholder="Tên hiển thị (tuỳ chọn)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button type="submit" className="btn btn-sm" disabled={busy || !staffId.trim()} data-testid="csd-chat-account-enable">
          Bật
        </button>
      </form>

      <input
        className="kpi-input"
        placeholder="Tìm tên, email, staff id…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: '20rem', margin: '1rem 0' }}
      />

      <table className="data-table" data-testid="csd-chat-accounts-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Tên</th>
            <th>Email</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                Chưa có tài khoản chat
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.staff_id}>
                <td>{row.staff_id}</td>
                <td>{row.display_name_vi || row.staff_name || '—'}</td>
                <td>{row.staff_email || '—'}</td>
                <td>{row.enabled ? 'Bật' : 'Tắt'}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void toggle(row)}>
                    {row.enabled ? 'Tắt' : 'Bật'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </AdminPageShell>
  );
}
