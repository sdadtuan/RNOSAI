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
    if (!canManage) return;
    const out = await fetchPortalStaff(token);
    setStaff(out.staff ?? []);
  }, [token, canManage]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được nhân viên'));
  }, [load]);

  if (!canManage) return null;

  return (
    <section>
      <h2>Nhân viên</h2>
      <p className="muted">Tài khoản nhận Lead và tin nhắn của Client này.</p>
      {error ? <p className="error">{error}</p> : null}
      <form
        className="portal-crm__staff"
        onSubmit={(e) => {
          e.preventDefault();
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
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mật khẩu" minLength={8} required />
        <button className="btn btn-sm" type="submit" disabled={busy}>Tạo nhân viên</button>
      </form>
      {staff.length === 0 ? <p className="muted">Chưa có nhân viên.</p> : null}
      <ul className="portal-crm__list">
        {staff.map((item) => (
          <li key={item.id}>
            <span>
              {item.email}
              <span className="muted"> · {item.active ? 'Đang nhận việc' : 'Đã tắt'}</span>
            </span>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
