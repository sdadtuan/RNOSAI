'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout/StaffPageShell';
import { useStaffAvatarBlob } from '@/components/account/useStaffAvatarBlob';
import {
  deleteStaffAvatar,
  fetchStaffAccount,
  revokeStaffSession,
  revokeStaffSessionsAll,
  revokeStaffSessionsOthers,
  staffChangePassword,
  staffMe,
  staffRefresh,
  uploadStaffAvatar,
  ApiError,
  type StaffAccountBundle,
  type StaffMeResponse,
} from '@/lib/api';
import { staffAccountErrorVi } from '@/lib/account/account-error.util';
import { cropAvatarFileToJpeg } from '@/lib/account/crop-avatar.util';
import { validatePasswordForm } from '@/lib/account/password-form.util';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

function formatDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

function userInitials(user: StoredStaffUser | StaffMeResponse | null): string {
  const name = user?.display_name?.trim() || user?.email?.trim() || '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function AccountPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [bundle, setBundle] = useState<StaffAccountBundle | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const profile = bundle?.profile ?? null;
  const avatarUrl = useStaffAvatarBlob(token, Boolean(profile?.has_avatar), profile?.avatar_updated_at);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  const reload = useCallback(async (access: string) => {
    const data = await fetchStaffAccount(access);
    setBundle(data);
    setUser(data.profile);
    updateStoredUser(data.profile);
  }, []);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      await staffMe(access);
      setToken(access);
      await reload(access);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        logout();
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      setUser(out.user);
      setToken(out.access_token);
      await reload(out.access_token);
      return out.access_token;
    }
  }, [logout, reload, router]);

  useEffect(() => {
    void ensureAuth().catch((err) => {
      setError(err instanceof Error ? err.message : 'Không tải tài khoản');
    });
  }, [ensureAuth]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const blob = await cropAvatarFileToJpeg(file);
      await uploadStaffAvatar(token, blob);
      setMsg('Đã cập nhật ảnh đại diện.');
      await reload(token);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : '';
      setError(staffAccountErrorVi(code) || (err instanceof Error ? err.message : 'Tải ảnh thất bại'));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAvatar() {
    if (!token) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await deleteStaffAvatar(token);
      setMsg('Đã xóa ảnh đại diện.');
      await reload(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa ảnh thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const check = validatePasswordForm({ current: currentPw, next: newPw, confirm: confirmPw });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await staffChangePassword(token, currentPw, newPw);
      setMsg('Đã đổi mật khẩu Nest. Các thiết bị khác đã đăng xuất.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      const code = err instanceof ApiError ? err.message : '';
      setError(staffAccountErrorVi(code) || 'Đổi mật khẩu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeSession(id: string) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const out = await revokeStaffSession(token, id);
      if (out.current_revoked) {
        logout();
        return;
      }
      await reload(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thu hồi phiên thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeOthers() {
    if (!token) return;
    if (!window.confirm('Hành động này đá phiên khác. Tiếp tục?')) return;
    setBusy(true);
    setError('');
    try {
      await revokeStaffSessionsOthers(token);
      setMsg('Đã đăng xuất các thiết bị khác.');
      await reload(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thu hồi phiên thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeAll() {
    if (!token) return;
    if (!window.confirm('Hành động này đá phiên khác. Tiếp tục?')) return;
    setBusy(true);
    setError('');
    try {
      await revokeStaffSessionsAll(token);
      logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thu hồi phiên thất bại');
      setBusy(false);
    }
  }

  return (
    <StaffPageShell user={user} onLogout={logout} breadcrumb={[{ label: 'Tài khoản' }]} loading={!bundle}>
      <div className="account-page">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="settings-form__success">{msg}</p> : null}

        {profile ? (
          <>
            <section className="card account-card">
              <h2>Hồ sơ</h2>
              <div className="account-profile-row">
                <div className="account-avatar-preview" aria-hidden="true">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" />
                  ) : (
                    userInitials(profile)
                  )}
                </div>
                <div>
                  <p>
                    <strong>{profile.display_name}</strong>
                  </p>
                  <p className="muted">{profile.email}</p>
                  <p className="muted">
                    Chức vụ: {profile.position_code ?? '—'}
                    {profile.teams?.length
                      ? ` · Team: ${profile.teams.map((t) => t.name).join(', ')}`
                      : null}
                  </p>
                  <p className="muted">Loại TK: {profile.account_kind ?? 'staff'}</p>
                  <p className="muted">
                    Lần đăng nhập gần nhất:{' '}
                    {profile.last_login_at ? formatDt(profile.last_login_at) : '—'}
                  </p>
                  <p>
                    {profile.oidc_linked ? (
                      <span className="account-badge">SSO đã liên kết</span>
                    ) : (
                      <span className="account-badge">Chưa liên kết SSO</span>
                    )}
                    {profile.password_login_enabled ? (
                      <span className="account-badge">Mật khẩu Nest</span>
                    ) : null}
                  </p>
                  <p className="muted" style={{ marginTop: '0.5rem' }}>
                    Sửa họ tên / chức vụ: liên hệ HR.
                  </p>
                  <div className="account-actions">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={onPickAvatar}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      Đổi ảnh
                    </button>
                    {profile.has_avatar ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => void onDeleteAvatar()}
                      >
                        Xóa ảnh
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="card account-card">
              <h2>Mật khẩu</h2>
              {profile.password_login_enabled ? (
                <form className="settings-form" onSubmit={onPasswordSubmit}>
                  <div className="field">
                    <label htmlFor="current_pw">Mật khẩu hiện tại</label>
                    <input
                      id="current_pw"
                      type="password"
                      autoComplete="current-password"
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="new_pw">Mật khẩu mới</label>
                    <input
                      id="new_pw"
                      type="password"
                      autoComplete="new-password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
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
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <button type="submit" className="btn" disabled={busy}>
                    {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
                  </button>
                </form>
              ) : null}
              {profile.sso_enabled && profile.keycloak_account_url ? (
                <p style={{ marginTop: profile.password_login_enabled ? '1rem' : 0 }}>
                  <a
                    href={profile.keycloak_account_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    Đổi mật khẩu trên Keycloak
                  </a>
                </p>
              ) : null}
              {profile.password_login_enabled && profile.sso_enabled ? (
                <p className="muted" style={{ marginTop: '0.75rem' }}>
                  SSO và mật khẩu Nest là hai nguồn riêng; đổi một bên không đổi bên kia.
                </p>
              ) : null}
            </section>

            <section className="card account-card">
              <h2>Bảo mật (MFA)</h2>
              <p>
                Chức vụ này bắt buộc OTP:{' '}
                <strong>{profile.mfa_required_for_position ? 'Có' : 'Không'}</strong>
              </p>
              {profile.keycloak_account_url ? (
                <a
                  href={profile.keycloak_account_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Quản lý OTP trên Keycloak
                </a>
              ) : null}
            </section>

            <section className="card account-card">
              <h2>Phiên đăng nhập</h2>
              <table className="account-table">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th>Phương thức</th>
                    <th>IP</th>
                    <th>Hoạt động</th>
                    <th>Hết hạn</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(bundle?.sessions.items ?? []).map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.current ? <span className="account-badge">Thiết bị này</span> : null}{' '}
                        {s.device_label}
                        {s.revoked_at ? (
                          <span className="account-badge" style={{ marginLeft: '0.35rem' }}>
                            Đã thu hồi
                          </span>
                        ) : null}
                      </td>
                      <td>{s.login_method === 'sso' ? 'SSO' : 'Mật khẩu Nest'}</td>
                      <td>{s.ip ?? '—'}</td>
                      <td>{formatDt(s.last_seen_at)}</td>
                      <td>{formatDt(s.expires_at)}</td>
                      <td>
                        {!s.revoked_at ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => void onRevokeSession(s.id)}
                          >
                            Thu hồi
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="account-actions">
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void onRevokeOthers()}>
                  Đăng xuất thiết bị khác
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void onRevokeAll()}>
                  Đăng xuất mọi thiết bị
                </button>
              </div>
            </section>

            <section className="card account-card">
              <h2>Nhật ký</h2>
              <ul className="account-audit-list">
                {(bundle?.audit.items ?? []).map((item) => (
                  <li key={item.id}>
                    <span>{item.summary_vi}</span>
                    <span className="muted">{formatDt(item.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </StaffPageShell>
  );
}
