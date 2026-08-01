'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  fetchPortalSettings,
  patchPortalSettings,
  portalChangePassword,
  testPortalPush,
  type PortalSettingsResponse,
} from '@/lib/api';
import { usePortalPush } from '@/hooks/usePortalPush';
import { useCapacitorNativePush } from '@/hooks/useCapacitorNativePush';

export default function SettingsPage() {
  return (
    <PortalPageShell>
        {({ token, user }) => (
          <>
            <CapacitorNativePushCard token={token} />
            <PushNotificationCard token={token} />
            <SettingsForm token={token} canEdit={user.role === 'approver'} />
            <ChangePasswordForm token={token} email={user.email} />
          </>
        )}
      </PortalPageShell>
  );
}

function CapacitorNativePushCard({ token }: { token: string }) {
  const {
    native,
    platform,
    registered,
    pushEnabled,
    forceUpdate,
    busy,
    error,
    enableNativePush,
    disableNativePush,
    sendTestPush,
  } = useCapacitorNativePush(token);
  const [testMessage, setTestMessage] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  if (!native) return null;

  async function onTestPush() {
    setTestBusy(true);
    setTestMessage('');
    try {
      const msg = await sendTestPush();
      setTestMessage(msg);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : 'Test native push failed');
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Native push (RNOS-M3 Capacitor)</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        App shell {platform} — FCM/APNs qua device token (tách khỏi Web Push PWA).
      </p>
      {forceUpdate ? (
        <p className="error">Cần cập nhật app lên phiên bản mới trước khi tiếp tục.</p>
      ) : null}
      {pushEnabled === false ? (
        <p className="muted">Native push chưa bật trên server (`PTT_MOBILE_NATIVE_PUSH_ENABLED`).</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {registered ? (
        <>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void disableNativePush()}>
            {busy ? 'Đang tắt…' : 'Tắt native push'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: '0.5rem' }}
            disabled={testBusy || pushEnabled === false}
            onClick={() => void onTestPush()}
          >
            {testBusy ? 'Đang gửi test…' : 'Gửi test native push'}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={busy || pushEnabled === false || forceUpdate}
          onClick={() => void enableNativePush()}
        >
          {busy ? 'Đang bật…' : 'Bật native push'}
        </button>
      )}
      {testMessage ? <p className="muted">{testMessage}</p> : null}
    </section>
  );
}

function PushNotificationCard({ token }: { token: string }) {
  const { supported, permission, subscribed, busy, error, enablePush, disablePush } = usePortalPush(token);
  const [testMessage, setTestMessage] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  async function onTestPush() {
    setTestBusy(true);
    setTestMessage('');
    try {
      const out = await testPortalPush(token);
      setTestMessage(out.message ?? (out.ok ? 'Test push OK' : 'Test push failed'));
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : 'Test push failed');
    } finally {
      setTestBusy(false);
    }
  }

  if (!supported) {
    return (
      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Thông báo đẩy (RNOS-M2)</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Trình duyệt không hỗ trợ Web Push hoặc PWA chưa bật.
        </p>
      </section>
    );
  }

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Thông báo đẩy (RNOS-M2)</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Nhận alert creative/email cần duyệt khi Portal chạy nền hoặc đã cài PWA.
      </p>
      <p className="muted">Quyền hiện tại: {permission}</p>
      {error ? <p className="error">{error}</p> : null}
      {subscribed ? (
        <>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void disablePush()}>
            {busy ? 'Đang tắt…' : 'Tắt thông báo đẩy'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: '0.5rem' }}
            disabled={testBusy}
            onClick={() => void onTestPush()}
          >
            {testBusy ? 'Đang gửi test…' : 'Gửi test push'}
          </button>
        </>
      ) : (
        <button type="button" className="btn" disabled={busy} onClick={() => void enablePush()}>
          {busy ? 'Đang bật…' : 'Bật thông báo đẩy'}
        </button>
      )}
      {testMessage ? <p className="muted">{testMessage}</p> : null}
    </section>
  );
}

function SettingsForm({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [settings, setSettings] = useState<PortalSettingsResponse | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [amName, setAmName] = useState('');
  const [amEmail, setAmEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchPortalSettings(token)
      .then((data) => {
        setSettings(data);
        setDisplayName(data.display_name ?? '');
        setLogoUrl(data.logo_url ?? '');
        setAmName(data.am_contact_name ?? '');
        setAmEmail(data.am_contact_email ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải settings'));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const out = await patchPortalSettings(token, {
        display_name: displayName.trim(),
        logo_url: logoUrl.trim(),
        am_contact_name: amName.trim(),
        am_contact_email: amEmail.trim(),
      });
      setSettings(out);
      setMessage('Đã lưu cài đặt portal.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Branding & liên hệ AM</h2>
      {!settings?.table_ready ? (
        <p className="muted">
          Bảng `portal_client_settings` chưa apply — hiển thị tên client mặc định. Chạy DDL v3-portal-settings trên PG.
        </p>
      ) : null}
      {!canEdit ? (
        <p className="muted">Chỉ role approver được chỉnh branding.</p>
      ) : null}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="display_name">Tên hiển thị</label>
          <input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!canEdit || busy}
          />
        </div>
        <div className="field">
          <label htmlFor="logo_url">Logo URL</label>
          <input
            id="logo_url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            disabled={!canEdit || busy}
            placeholder="https://..."
          />
        </div>
        <div className="field">
          <label htmlFor="am_name">Tên AM</label>
          <input
            id="am_name"
            value={amName}
            onChange={(e) => setAmName(e.target.value)}
            disabled={!canEdit || busy}
          />
        </div>
        <div className="field">
          <label htmlFor="am_email">Email AM</label>
          <input
            id="am_email"
            type="email"
            value={amEmail}
            onChange={(e) => setAmEmail(e.target.value)}
            disabled={!canEdit || busy}
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        {canEdit ? (
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu cài đặt'}
          </button>
        ) : null}
      </form>
      <p className="muted" style={{ marginTop: '1rem', marginBottom: 0 }}>
        PDF export performance hiện ở dạng stub — báo cáo đầy đủ sẽ có ở Phase 4.
      </p>
    </section>
  );
}

function ChangePasswordForm({ token, email }: { token: string; email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (next.length < 8) {
      setError('Mật khẩu mới tối thiểu 8 ký tự.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await portalChangePassword(token, current, next);
      setMessage('Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: '1rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Đổi mật khẩu</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Tài khoản: {email}
      </p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="current_pw">Mật khẩu hiện tại</label>
          <input
            id="current_pw"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new_pw">Mật khẩu mới</label>
          <input
            id="new_pw"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm_pw">Xác nhận mật khẩu mới</label>
          <input
            id="confirm_pw"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
      </form>
    </section>
  );
}
