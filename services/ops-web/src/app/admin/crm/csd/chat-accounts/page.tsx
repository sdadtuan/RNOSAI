'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { hasCap } from '@/lib/auth';
import {
  fetchCsdChatAccountsAdmin,
  fetchCsdChatStaffDirectory,
  upsertCsdChatAccount,
  type CsdChatAccountAdminRow,
  type CsdChatStaffDirectoryRow,
} from '@/lib/crm/csd-api';

function loginErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  if (code === 'staff_not_found') return 'Không tìm thấy nhân viên trong hệ thống';
  if (code === 'password_too_short') return 'Mật khẩu đăng nhập /login tối thiểu 6 ký tự';
  if (code === 'staff_email_required') return 'NV chưa có email — bổ sung email trước khi tạo /login';
  if (code === 'staff_position_required') return 'NV chưa có chức vụ — gán chức vụ trước khi tạo tài khoản /login';
  return err instanceof Error ? err.message : 'Thao tác thất bại';
}

function generateLoginPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function AdminCsdChatAccountsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth((u) => hasCap(u, 'csd', 'admin'));
  const [rows, setRows] = useState<CsdChatAccountAdminRow[]>([]);
  const [directory, setDirectory] = useState<CsdChatStaffDirectoryRow[]>([]);
  const [q, setQ] = useState('');
  const [staffId, setStaffId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loginPassword, setLoginPassword] = useState(() => generateLoginPassword());
  const [msg, setMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => directory.find((row) => String(row.staff_id) === staffId) ?? null,
    [directory, staffId],
  );

  const reload = useCallback(
    async (access: string, query?: string) => {
      const [accounts, people] = await Promise.all([
        fetchCsdChatAccountsAdmin(access, query),
        fetchCsdChatStaffDirectory(access),
      ]);
      setRows(accounts.items ?? []);
      setDirectory(people.items ?? []);
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
      setMsg(row.enabled ? `Đã tắt ${row.staff_name || `staff #${row.staff_id}`}` : `Đã bật ${row.staff_name || `staff #${row.staff_id}`}`);
    } catch (err) {
      setFormError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function enableNew(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected) {
      setFormError('Chọn nhân viên trong hệ thống');
      return;
    }
    const password = loginPassword.trim();
    if (password.length < 6) {
      setFormError('Mật khẩu đăng nhập /login tối thiểu 6 ký tự');
      return;
    }
    setBusy(true);
    setFormError('');
    setMsg('');
    try {
      await upsertCsdChatAccount(token, {
        staff_id: selected.staff_id,
        enabled: true,
        display_name_vi: displayName.trim() || selected.staff_name || undefined,
        login_password: password,
      });
      setStaffId('');
      setDisplayName('');
      const next = generateLoginPassword();
      setLoginPassword(next);
      await reload(token, q);
      setMsg(
        `Đã bật chat cho ${selected.staff_name || selected.staff_email}. Gửi mật khẩu /login cho NV rồi đăng xuất/nhập lại.`,
      );
    } catch (err) {
      setFormError(loginErrorMessage(err));
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
      subtitle="Chọn NV có sẵn. Mật khẩu tạo ở đây là mật khẩu đăng nhập /login — không có mật khẩu chat thứ hai."
      loading={loading}
    >
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="muted">{msg}</p> : null}
      {formError ? <p className="error">{formError}</p> : null}

      <form className="csd-chat-account-form" onSubmit={(e) => void enableNew(e)}>
        <select
          className="kpi-input"
          value={staffId}
          onChange={(e) => {
            const next = e.target.value;
            setStaffId(next);
            const person = directory.find((row) => String(row.staff_id) === next);
            if (person && !displayName.trim()) setDisplayName(person.staff_name);
          }}
          data-testid="csd-chat-account-staff-id"
          required
        >
          <option value="">Chọn nhân viên…</option>
          {directory.map((row) => (
            <option key={row.staff_id} value={row.staff_id}>
              {row.staff_name || 'Không tên'}
              {row.staff_email ? ` — ${row.staff_email}` : ''}
              {row.has_login ? '' : ' (chưa có /login)'}
            </option>
          ))}
        </select>
        <input
          className="kpi-input"
          placeholder="Tên hiển thị chat (tuỳ chọn)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          className="kpi-input"
          type="text"
          autoComplete="new-password"
          placeholder="Mật khẩu đăng nhập /login"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          data-testid="csd-chat-account-password"
          required
          minLength={6}
        />
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => setLoginPassword(generateLoginPassword())}
        >
          Tạo mật khẩu
        </button>
        <button type="submit" className="btn btn-sm" disabled={busy || !staffId} data-testid="csd-chat-account-enable">
          Bật
        </button>
      </form>
      {selected ? (
        <p className="muted" style={{ marginTop: '0.35rem' }}>
          {selected.has_login
            ? `Sẽ đặt lại mật khẩu /login của ${selected.staff_email || selected.staff_name}.`
            : `Sẽ tạo tài khoản /login cho ${selected.staff_email || selected.staff_name}. NV cần có email và chức vụ.`}
        </p>
      ) : null}

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
