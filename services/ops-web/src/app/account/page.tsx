'use client';

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout/StaffPageShell';
import { WinDrawer } from '@/components/win';
import { StaffTurnstile, TURNSTILE_SITE_KEY } from '@/components/account/StaffTurnstile';
import { useStaffAvatarBlob } from '@/components/account/useStaffAvatarBlob';
import {
  deleteStaffAvatar,
  fetchStaffAccount,
  fetchStaffSsoConfig,
  revokeStaffSession,
  revokeStaffSessionsAll,
  revokeStaffSessionsOthers,
  staffChangePassword,
  staffMe,
  staffPasswordStepUp,
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
  buildStaffKeycloakAuthUrl,
  clearPkceSession,
  readPkceState,
  readPkceVerifier,
} from '@/lib/auth/keycloak-pkce';
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

type AccountTab = 'profile' | 'security' | 'sessions' | 'audit';

const ACCOUNT_TABS: Array<{ id: AccountTab; label: string }> = [
  { id: 'profile', label: 'Hồ sơ' },
  { id: 'security', label: 'Bảo mật' },
  { id: 'sessions', label: 'Phiên' },
  { id: 'audit', label: 'Nhật ký' },
];

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải…</p>}>
      <AccountPageContent />
    </Suspense>
  );
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountTab>('profile');

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

  function openPasswordDrawer() {
    setDrawerError('');
    setTurnstileToken(null);
    setPasswordDrawerOpen(true);
  }

  function closePasswordDrawer() {
    setDrawerError('');
    setTurnstileToken(null);
    setPasswordDrawerOpen(false);
  }

  const startPasswordStepUp = useCallback(async () => {
    setDrawerError('');
    setBusy(true);
    try {
      const cfg = await fetchStaffSsoConfig();
      if (!cfg.issuer) {
        setDrawerError(staffAccountErrorVi('step_up_not_available'));
        return;
      }
      const url = await buildStaffKeycloakAuthUrl({
        issuer: cfg.issuer,
        clientId: cfg.client_id,
        redirectUri: `${window.location.origin}/account`,
        acrValues: 'mfa',
        prompt: 'login',
        flow: 'password_step_up',
      });
      window.location.href = url;
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'Không mở được Keycloak');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code || !token) return;
    const verifier = readPkceVerifier('password_step_up');
    if (!verifier) return;
    const expectedState = readPkceState('password_step_up');
    const urlState = searchParams.get('state');
    if (expectedState && urlState !== expectedState) {
      setError('State OIDC không khớp.');
      return;
    }
    void (async () => {
      setBusy(true);
      setError('');
      try {
        await staffPasswordStepUp(token, code, `${window.location.origin}/account`, verifier);
        clearPkceSession('password_step_up');
        router.replace('/account');
        setMsg('Đã xác minh OTP. Có thể đổi mật khẩu Nest.');
        setPasswordDrawerOpen(true);
        await reload(token);
      } catch (err) {
        clearPkceSession('password_step_up');
        const codeErr = err instanceof ApiError ? err.message : '';
        setError(staffAccountErrorVi(codeErr) || 'Xác minh OTP thất bại');
        router.replace('/account');
      } finally {
        setBusy(false);
      }
    })();
  }, [searchParams, token, router, reload]);

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setDrawerError(staffAccountErrorVi('captcha_required'));
      return;
    }
    const check = validatePasswordForm({ current: currentPw, next: newPw, confirm: confirmPw });
    if (!check.ok) {
      setDrawerError(check.error);
      return;
    }
    setBusy(true);
    setDrawerError('');
    setError('');
    setMsg('');
    try {
      await staffChangePassword(token, currentPw, newPw, turnstileToken ?? undefined);
      setMsg('Đã đổi mật khẩu Nest. Các thiết bị khác đã đăng xuất.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTurnstileToken(null);
      closePasswordDrawer();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : '';
      setDrawerError(staffAccountErrorVi(code) || 'Đổi mật khẩu thất bại');
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

  const stepUpRequired = Boolean(profile?.password_step_up_required);
  const stepUpActive = Boolean(profile?.password_step_up_active);
  const canSubmitPassword =
    Boolean(profile?.password_login_enabled) &&
    (!stepUpRequired || stepUpActive) &&
    (!TURNSTILE_SITE_KEY || Boolean(turnstileToken));

  return (
    <StaffPageShell user={user} onLogout={logout} breadcrumb={[{ label: 'Tài khoản' }]} loading={!bundle}>
      <div className="account-page">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="settings-form__success">{msg}</p> : null}

        {profile ? (
          <>
            <section className="card account-card">
              <div className="account-tabs" role="tablist" aria-label="Tài khoản">
                {ACCOUNT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`account-tab${activeTab === tab.id ? ' account-tab--active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'profile' ? (
                <div className="account-tab-panel" role="tabpanel">
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
                        {profile.password_login_enabled ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={openPasswordDrawer}
                          >
                            Đổi mật khẩu
                          </button>
                        ) : null}
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
                </div>
              ) : null}

              {activeTab === 'security' ? (
                <div className="account-tab-panel" role="tabpanel">
                  <p>
                    Chức vụ này bắt buộc OTP:{' '}
                    <strong>{profile.mfa_required_for_position ? 'Có' : 'Không'}</strong>
                  </p>
                  {profile.keycloak_account_url ? (
                    <>
                      <a
                        href={profile.keycloak_account_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        Quản lý OTP trên Keycloak
                      </a>
                      {!profile.password_login_enabled ? (
                        <p style={{ marginTop: '0.75rem' }}>
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
                    </>
                  ) : (
                    <p className="muted">Chưa cấu hình Keycloak account URL.</p>
                  )}
                </div>
              ) : null}

              {activeTab === 'sessions' ? (
                <div className="account-tab-panel" role="tabpanel">
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
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => void onRevokeOthers()}
                    >
                      Đăng xuất thiết bị khác
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => void onRevokeAll()}
                    >
                      Đăng xuất mọi thiết bị
                    </button>
                  </div>
                </div>
              ) : null}

              {activeTab === 'audit' ? (
                <div className="account-tab-panel" role="tabpanel">
                  <ul className="account-audit-list">
                    {(bundle?.audit.items ?? []).map((item) => (
                      <li key={item.id}>
                        <span>{item.summary_vi}</span>
                        <span className="muted">{formatDt(item.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <WinDrawer
              open={passwordDrawerOpen}
              title="Đổi mật khẩu"
              onClose={closePasswordDrawer}
              footer={
                profile?.password_login_enabled ? (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={closePasswordDrawer}>
                      Hủy
                    </button>
                    <button type="submit" form="account-password-form" className="btn btn-sm" disabled={busy || !canSubmitPassword}>
                      {busy ? 'Đang lưu…' : 'Lưu mật khẩu'}
                    </button>
                  </>
                ) : null
              }
            >
              {drawerError ? <p className="error">{drawerError}</p> : null}
              {stepUpRequired ? (
                <div className="account-step-up">
                  {stepUpActive ? (
                    <p className="settings-form__success">
                      OTP đã xác minh
                      {profile.password_step_up_active_until
                        ? ` — hiệu lực đến ${formatDt(profile.password_step_up_active_until)}`
                        : ''}
                      .
                    </p>
                  ) : (
                    <>
                      <p className="muted">Chức vụ này cần xác minh OTP trên Keycloak trước khi đổi mật khẩu Nest.</p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => void startPasswordStepUp()}
                      >
                        Xác minh OTP
                      </button>
                    </>
                  )}
                </div>
              ) : null}
              {profile.password_login_enabled && (!stepUpRequired || stepUpActive) ? (
                <form id="account-password-form" className="settings-form" onSubmit={onPasswordSubmit}>
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
                  <StaffTurnstile active={passwordDrawerOpen} onToken={setTurnstileToken} />
                </form>
              ) : null}
              {profile.password_login_enabled && profile.sso_enabled ? (
                <p className="muted">SSO và mật khẩu Nest là hai nguồn riêng; đổi một bên không đổi bên kia.</p>
              ) : null}
            </WinDrawer>
          </>
        ) : null}
      </div>
    </StaffPageShell>
  );
}
