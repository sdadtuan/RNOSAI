'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createClientPortalUser,
  fetchClientPortalPages,
  fetchClientPortalUsers,
  patchClientPortalUser,
  resetClientPortalUserPassword,
  type PortalClientPage,
  type PortalClientUser,
} from '@/lib/api';

type Props = {
  token: string;
  clientId: string;
  canMutate: boolean;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

const ID_GROUPS: { id: PortalClientPage['channel']; label: string }[] = [
  { id: 'facebook', label: 'Page ID' },
  { id: 'zalo', label: 'Zalo ID' },
  { id: 'google', label: 'Google' },
  { id: 'tiktok', label: 'TikTok' },
];

function fmtDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
}

function emailDeliveryMessage(
  delivery: { ok: boolean; skipped?: boolean; error?: string } | undefined,
): string {
  if (!delivery) return '';
  if (delivery.skipped) {
    return ' Email chưa gửi (PTT_PORTAL_EMAIL_NOTIFY=0 hoặc webhook chưa cấu hình).';
  }
  if (!delivery.ok) {
    return ` Gửi email thất bại: ${delivery.error ?? 'unknown'}.`;
  }
  return ' Đã gửi email thông tin đăng nhập theo template.';
}

export function ClientPortalUsersPanel({ token, clientId, canMutate, onMessage, onError }: Props) {
  const [users, setUsers] = useState<PortalClientUser[]>([]);
  const [pages, setPages] = useState<PortalClientPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'viewer' as 'viewer' | 'approver' | 'staff',
    sendEmail: true,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [out, pageOut] = await Promise.all([
        fetchClientPortalUsers(token, clientId),
        fetchClientPortalPages(token, clientId),
      ]);
      setUsers(out.users ?? []);
      setPages(pageOut.pages ?? []);
      setTableReady(out.table_ready !== false);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải portal users thất bại');
      setUsers([]);
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [token, clientId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    setBusy(true);
    setRevealedPassword(null);
    onError?.('');
    try {
      const body: {
        email: string;
        role: 'viewer' | 'approver' | 'staff';
        password?: string;
        send_email?: boolean;
      } = {
        email: form.email.trim(),
        role: form.role,
        send_email: form.sendEmail,
      };
      if (form.password.trim()) {
        body.password = form.password.trim();
      }
      const out = await createClientPortalUser(token, clientId, body);
      const emailNote = emailDeliveryMessage(out.email_delivery);
      if (out.temporary_password) {
        setRevealedPassword(out.temporary_password);
        onMessage?.(
          `Đã tạo portal user ${out.user.email}.${emailNote} Mật khẩu tạm hiển thị bên dưới — sao chép dự phòng.`,
        );
      } else {
        onMessage?.(`Đã tạo portal user ${out.user.email}.${emailNote}`);
      }
      setForm({ email: '', password: '', role: 'viewer', sendEmail: true });
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tạo portal user thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(user: PortalClientUser) {
    if (!canMutate) return;
    const next = !user.active;
    const label = next ? 'kích hoạt lại' : 'vô hiệu hoá';
    if (!window.confirm(`${label} portal user ${user.email}?`)) return;
    setBusy(true);
    onError?.('');
    try {
      await patchClientPortalUser(token, clientId, user.id, { active: next });
      onMessage?.(`Đã ${label} ${user.email}`);
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Cập nhật portal user thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(user: PortalClientUser, role: 'viewer' | 'approver' | 'staff') {
    if (!canMutate || user.role === role) return;
    setBusy(true);
    onError?.('');
    try {
      await patchClientPortalUser(token, clientId, user.id, { role });
      onMessage?.(`Đã đổi role ${user.email} → ${role}`);
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Đổi role thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(user: PortalClientUser, sendEmail = false) {
    if (!canMutate) return;
    const prompt = sendEmail
      ? `Reset mật khẩu và gửi email template cho ${user.email}? Mật khẩu mới sẽ hiển thị một lần trên màn hình.`
      : `Reset mật khẩu cho ${user.email}? Mật khẩu mới sẽ hiển thị một lần.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setRevealedPassword(null);
    onError?.('');
    try {
      const out = await resetClientPortalUserPassword(token, clientId, user.id, { send_email: sendEmail });
      const emailNote = emailDeliveryMessage(out.email_delivery);
      if (out.temporary_password) {
        setRevealedPassword(out.temporary_password);
        onMessage?.(
          `Mật khẩu mới cho ${user.email}.${emailNote} Sao chép ngay (vault/handover A4).`,
        );
      } else {
        onMessage?.(`Đã reset mật khẩu ${user.email}.${emailNote}`);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Reset mật khẩu thất bại');
    } finally {
      setBusy(false);
    }
  }

  const selectedUser = users.find((user) => user.id === selectedId) ?? null;

  return (
    <div className="portal-users-panel">
      <p className="muted" style={{ marginTop: 0 }}>
        Account đăng nhập Client CRM của đúng Client này. Đăng nhập cùng trang{' '}
        <a href="/login">/login</a>.
      </p>

      {!tableReady ? (
        <p className="error">
          Bảng <code>portal_client_users</code> chưa có trên DB — chạy migration DDL Sprint 0 trước.
        </p>
      ) : null}

      {revealedPassword ? (
        <div
          className="card"
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderColor: 'var(--accent)',
            background: 'rgba(255, 193, 7, 0.08)',
          }}
        >
          <strong>Mật khẩu tạm (hiển thị một lần)</strong>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <code style={{ fontSize: '1.1rem', userSelect: 'all' }}>{revealedPassword}</code>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                void navigator.clipboard.writeText(revealedPassword);
                onMessage?.('Đã copy mật khẩu vào clipboard');
              }}
            >
              Copy
            </button>
            <button type="button" className="btn btn-sm btn-muted" onClick={() => setRevealedPassword(null)}>
              Ẩn
            </button>
          </div>
        </div>
      ) : null}

      {canMutate && tableReady ? (
        <form className="agency-client-edit" onSubmit={(e) => void handleCreate(e)} style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>+ Tạo account đăng nhập Client CRM</h3>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              placeholder="owner@glowbeautyspa.vn"
            />
          </label>
          <label>
            Mật khẩu (để trống = tự sinh)
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="min 8 ký tự hoặc auto-generate"
              autoComplete="new-password"
            />
          </label>
          <label>
            Vai trò
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'viewer' | 'approver' | 'staff' }))}>
              <option value="viewer">Viewer — xem báo cáo</option>
              <option value="approver">Approver — xem + duyệt</option>
              <option value="staff">Nhân viên — xem và nhận Lead, tin nhắn</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.sendEmail}
              onChange={(e) => setForm((f) => ({ ...f, sendEmail: e.target.checked }))}
            />
            <span>Gửi email thông tin đăng nhập theo template</span>
          </label>
          <div>
            <button type="submit" className="btn btn-sm" disabled={busy}>
              Tạo account
            </button>
          </div>
        </form>
      ) : null}

      <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Danh sách ({users.length})</h3>
      {loading ? <p className="muted">Đang tải…</p> : null}
      {!loading && users.length === 0 ? <p className="muted">Chưa có account đăng nhập cho Client này.</p> : null}
      {!loading && users.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Trạng thái</th>
                <th>Login cuối</th>
                {canMutate ? <th>Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={selectedId === user.id ? { background: 'rgba(23, 105, 47, 0.08)' } : undefined}>
                  <td>
                    <button
                      type="button"
                      className="nav-link"
                      style={{ padding: 0, fontWeight: selectedId === user.id ? 700 : 400 }}
                      onClick={() => setSelectedId((current) => (current === user.id ? null : user.id))}
                    >
                      {user.email}
                    </button>
                  </td>
                  <td>
                    {canMutate ? (
                      <select
                        value={user.role}
                        disabled={busy}
                        onChange={(e) => void handleRoleChange(user, e.target.value as 'viewer' | 'approver' | 'staff')}
                      >
                        <option value="viewer">viewer</option>
                        <option value="approver">approver</option>
                        <option value="staff">nhân viên</option>
                      </select>
                    ) : (
                      user.role
                    )}
                  </td>
                  <td>
                    <span className={`agency-status-badge ${user.active ? 'badge-active' : 'badge-paused'}`}>
                      {user.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="muted">{fmtDate(user.last_login_at)}</td>
                  {canMutate ? (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void handleResetPassword(user)}>
                        Reset MK
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => void handleResetPassword(user, true)}
                      >
                        Gửi email MK
                      </button>{' '}
                      <button type="button" className="btn btn-sm btn-muted" disabled={busy} onClick={() => void handleToggleActive(user)}>
                        {user.active ? 'Vô hiệu' : 'Kích hoạt'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {selectedUser ? (
        <div className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>ID của {selectedUser.email}</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Chỉ các ID gắn với Client này. Client khác không thấy bộ ID này.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {ID_GROUPS.map((group) => {
              const rows = pages.filter((page) => (page.channel || 'facebook') === group.id);
              return (
                <section key={group.id}>
                  <strong>{group.label}</strong>
                  {rows.length === 0 ? <p className="muted">Chưa gắn</p> : null}
                  <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                    {rows.map((page) => (
                      <li key={page.id}>
                        <code>{page.page_id}</code>
                        {page.page_name ? ` · ${page.page_name}` : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
