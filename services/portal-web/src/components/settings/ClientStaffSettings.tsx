'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortalStaff, fetchPortalStaff, setPortalStaffActive } from '@/lib/api';

export function ClientStaffSettings({ token, canManage }: { token: string; canManage: boolean }) {
  const [staff, setStaff] = useState<Array<{ id: string; email: string; active: boolean }>>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const out = await fetchPortalStaff(token);
    setStaff(out.staff ?? []);
  }, [token]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được nhân viên'));
  }, [load]);

  return (
    <section>
      <h2>Nhân viên</h2>
      <p className="muted">Tài khoản nhận lead và tin nhắn của khách hàng này.</p>
      {!canManage ? (
        <p className="muted">Bạn chỉ có quyền xem danh sách — chỉ quản trị viên mới thêm hoặc tắt nhân viên.</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {canManage ? (
      <form
        className="portal-crm__staff"
        onSubmit={(e) => {
          e.preventDefault();
          if (password.length < 8) {
            setError('Mật khẩu nhân viên tối thiểu 8 ký tự.');
            return;
          }
          setBusy(true);
          setError('');
          void createPortalStaff(token, email.trim(), password)
            .then(async () => {
              setEmail('');
              setPassword('');
              await load();
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tạo được nhân viên'))
            .finally(() => setBusy(false));
        }}
      >
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email nhân viên" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mật khẩu (tối thiểu 8 ký tự)" required />
        <button className="btn btn-sm" type="submit" disabled={busy}>Tạo nhân viên</button>
      </form>
      ) : null}
      {staff.length === 0 ? <p className="muted">Chưa có nhân viên.</p> : null}
      <ul className="portal-crm__list">
        {staff.map((item) => (
          <li key={item.id}>
            <span>
              {item.email}
              <span className="muted"> · {item.active ? 'Đang nhận việc' : 'Đã tắt'}</span>
            </span>
            {canManage ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void setPortalStaffActive(token, item.id, !item.active)
                  .then(load)
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không cập nhật được'))
                  .finally(() => setBusy(false));
              }}
            >
              {item.active ? 'Tắt' : 'Bật'}
            </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
