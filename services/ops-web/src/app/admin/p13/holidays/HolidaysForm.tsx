'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken, updateStoredUser, type StoredStaffUser } from '@/lib/auth';
import { deleteP13Holiday, fetchP13Holidays, saveP13Holiday } from '@/lib/p13/api';
import { canManageP13Holidays, p13Enabled } from '@/lib/p13/flags';

export function HolidaysForm() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<Array<{ holiday_date: string; name: string }>>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  const ensureAuth = useCallback(async () => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(access);
      updateStoredUser(me);
      return { token: access, me };
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      const me = await staffMe(out.access_token);
      updateStoredUser(me);
      return { token: out.access_token, me };
    }
  }, [router]);

  const reload = useCallback(async (access: string) => {
    const body = await fetchP13Holidays(access);
    setRows(body.holidays);
    setWarning(body.warning);
  }, []);

  useEffect(() => {
    void (async () => {
      const auth = await ensureAuth();
      if (!auth) return;
      setUser(auth.me);
      setToken(auth.token);
      if (!p13Enabled(auth.me) || !canManageP13Holidays(auth.me)) {
        setError('Bạn không có quyền xem mục này. Cần p13.holidays.manage.');
        setLoading(false);
        return;
      }
      try {
        await reload(auth.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được ngày lễ');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, reload]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    try {
      await saveP13Holiday(token, date, name);
      setDate('');
      setName('');
      await reload(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    }
  }

  return (
    <StaffPageShell user={user} onLogout={() => { clearSession(); router.replace('/login'); }} loading={loading} breadcrumb={[{ label: 'Quản trị', href: '/admin' }, { label: 'Ngày lễ P13' }]}>
      <h1>Ngày lễ</h1>
      <p className="muted">Lịch trống vẫn tính ngày làm việc thứ Hai–thứ Sáu và hiện cảnh báo holiday_calendar_empty.</p>
      {warning ? <p className="p13-banner">Lịch ngày lễ đang trống.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <div className="p13-skel" /> : null}
      {!loading && rows.length === 0 && !error ? <p>Chưa có ngày lễ. CEO hoặc SUPER-ADMIN thêm ngày bên dưới.</p> : null}
      <ul>{rows.map((row) => <li key={row.holiday_date}>{row.holiday_date.split('-').reverse().join('/')} — {row.name} <button className="btn btn-sm" type="button" onClick={() => void deleteP13Holiday(token, row.holiday_date.slice(0, 10)).then(() => reload(token))}>Xóa</button></li>)}</ul>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.5rem', maxWidth: 360 }}>
        <input className="p13-field" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} required />
        <input className="p13-field" placeholder="Tên ngày lễ" value={name} onChange={(ev) => setName(ev.target.value)} required />
        <button className="btn" type="submit">Thêm ngày lễ</button>
      </form>
    </StaffPageShell>
  );
}
