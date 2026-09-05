'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
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
import {
  fetchAmCommandCenter,
  fetchAmNotifications,
  type AmCommandCenter,
  type AmNotificationItem,
  type AmScope,
} from '@/lib/crm/am-api';
import { AM_NAV, canSeeAmNav, type AmNavItem } from '@/lib/crm/am-nav.util';
import { showAmNotifyDot } from '@/lib/crm/am-notify.util';
import { AmCreateMenu } from './AmCreateMenu';
import { AmPalette } from './AmPalette';

export type AmRoleLabel = 'Admin' | 'Director' | 'AM';
export type AmDensity = 'comfortable' | 'compact';
export type AmCreateKind = 'client' | 'task' | 'plan' | 'interaction';

export type AmPageContextValue = {
  user: StoredStaffUser;
  token: string;
  canEdit: boolean;
  roleLabel: AmRoleLabel;
  scope: AmScope;
  data: AmCommandCenter | null;
  loading: boolean;
  error: string;
  retry: () => void;
  createKind: AmCreateKind | null;
  openCreate: (kind: AmCreateKind) => void;
  closeCreate: () => void;
};

const AmPageContext = createContext<AmPageContextValue | null>(null);

export function useAmPage(): AmPageContextValue {
  const ctx = useContext(AmPageContext);
  if (!ctx) {
    throw new Error('useAmPage must be used inside AmShell');
  }
  return ctx;
}

const COLLAPSE_KEY = 'am-sidebar-collapsed';
const DENSITY_KEY = 'am-density';

function amRoleLabel(user: StoredStaffUser | null): AmRoleLabel {
  if (hasCap(user, 'crm_am', 'manage')) return 'Admin';
  if (hasCap(user, 'crm_am', 'view_all')) return 'Director';
  return 'AM';
}

function parseScope(raw: string | null): AmScope {
  if (raw === 'team' || raw === 'all') return raw;
  return 'me';
}

function parseDensity(raw: string | null): AmDensity {
  return raw === 'compact' ? 'compact' : 'comfortable';
}

function navIsActive(pathname: string, href: string): boolean {
  if (href === '/crm/account-management') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupNav(items: AmNavItem[]): Array<{ group: AmNavItem['group']; items: AmNavItem[] }> {
  const groups: Array<{ group: AmNavItem['group']; items: AmNavItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}

function AmShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [data, setData] = useState<AmCommandCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [density, setDensity] = useState<AmDensity>('comfortable');
  const [createKind, setCreateKind] = useState<AmCreateKind | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyItems, setNotifyItems] = useState<AmNotificationItem[]>([]);
  const [notifyUnread, setNotifyUnread] = useState(0);

  const canEdit = hasCap(user, 'crm_am', 'edit');
  const roleLabel = amRoleLabel(user);
  const canPickScope = hasCap(user, 'crm_am', 'view_all') || hasCap(user, 'crm_am', 'manage');

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);

    async function finish(me: StoredStaffUser, accessToken: string): Promise<string | null> {
      setUser(me);
      updateStoredUser(me);
      if (!canSeeAmNav(me)) {
        router.replace(`/403?from=${encodeURIComponent(window.location.pathname)}`);
        return null;
      }
      setToken(accessToken);
      return accessToken;
    }

    try {
      const me = await staffMe(access);
      return finish(me, access);
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
      return finish(me, access);
    }
  }, [router]);

  const loadCenter = useCallback(async (access: string, nextScope: AmScope) => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchAmCommandCenter(access, { scope: nextScope });
      setData(out);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async (access: string) => {
    try {
      const out = await fetchAmNotifications(access);
      setNotifyItems(out.items);
      setNotifyUnread(out.unread);
    } catch {
      setNotifyItems([]);
      setNotifyUnread(0);
    }
  }, []);

  const retry = useCallback(() => {
    if (!token) return;
    void loadCenter(token, scope);
  }, [loadCenter, scope, token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    setDensity(parseDensity(window.localStorage.getItem(DENSITY_KEY)));
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const access = await ensureAuth();
      if (access) {
        await loadCenter(access, scope);
        await loadNotifications(access);
      }
      setLoading(false);
    })();
  }, [ensureAuth, loadCenter, loadNotifications, scope]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      }
      return next;
    });
  }

  function changeDensity(next: AmDensity) {
    setDensity(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DENSITY_KEY, next);
    }
  }

  function changeScope(next: AmScope) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'me') params.delete('scope');
    else params.set('scope', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const groups = useMemo(() => groupNav(AM_NAV), []);
  const loadOver = data != null && data.load.accounts > data.load.quota;
  const openCreate = useCallback((kind: AmCreateKind) => {
    if (!canEdit) return;
    setCreateKind(kind);
  }, [canEdit]);

  const closeCreate = useCallback(() => setCreateKind(null), []);

  const ctx = useMemo<AmPageContextValue | null>(() => {
    if (!user || !token) return null;
    return {
      user,
      token,
      canEdit,
      roleLabel,
      scope,
      data,
      loading,
      error,
      retry,
      createKind,
      openCreate,
      closeCreate,
    };
  }, [canEdit, closeCreate, createKind, data, error, loading, openCreate, retry, roleLabel, scope, token, user]);

  const rootClass = [
    'am-root',
    collapsed ? 'am-root--collapsed' : '',
    density === 'compact' ? 'am-root--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <StaffPageShell user={user} onLogout={logout} loading={loading && !user} width="full">
      {user && ctx ? (
        <AmPageContext.Provider value={ctx}>
          <div className={rootClass} data-density={density}>
            <aside className="am-sidebar" aria-label="Account Management">
              <nav className="am-sidebar__nav">
                {groups.map((group) => (
                  <div key={group.group} className="am-sidebar__group">
                    {collapsed ? null : <p className="am-sidebar__group-label">{group.group}</p>}
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`am-sidebar__link${navIsActive(pathname, item.href) ? ' is-active' : ''}`}
                        title={item.label}
                      >
                        <span>{collapsed ? item.label.slice(0, 1) : item.label}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>
              <div className="am-sidebar__foot">
                {collapsed ? null : (
                  <>
                    <b>{user.display_name || user.email}</b>
                    <span>
                      {roleLabel}
                      {loadOver ? ` · tải ${data.load.accounts}/${data.load.quota}` : ''}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  className="am-sidebar__collapse"
                  onClick={toggleCollapsed}
                  title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                  aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                >
                  {collapsed ? '»' : '« Thu gọn'}
                </button>
              </div>
            </aside>
            <div className="am-column">
              <header className="am-top">
                <button
                  type="button"
                  className="am-search"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Tìm kiếm Account Management"
                >
                  <span>Tìm account, HĐ, việc…</span>
                  <kbd className="am-search__kbd">⌘K</kbd>
                </button>
                <label className="am-scope">
                  <span>Phạm vi</span>
                  <select
                    value={scope}
                    disabled={!canPickScope && scope === 'me'}
                    onChange={(ev) => changeScope(parseScope(ev.target.value))}
                    aria-label="Phạm vi"
                  >
                    <option value="me">Của tôi</option>
                    {canPickScope ? <option value="team">Team</option> : null}
                    {canPickScope ? <option value="all">Toàn bộ</option> : null}
                  </select>
                </label>
                <span className="am-role" aria-label="Vai trò">
                  {roleLabel}
                </span>
                <label className="am-density">
                  <span>Mật độ</span>
                  <select
                    value={density}
                    onChange={(ev) => changeDensity(parseDensity(ev.target.value))}
                    aria-label="Mật độ"
                  >
                    <option value="comfortable">Thoải mái</option>
                    <option value="compact">Gọn</option>
                  </select>
                </label>
                <span
                  className={`am-fresh${data?.freshness.stale ? ' am-fresh--stale' : ''}`}
                  aria-label="Độ tươi dữ liệu"
                >
                  {data?.freshness.work_left_label ?? '—'}
                </span>
                <div className="am-bell">
                  <button
                    type="button"
                    className="am-bell__btn"
                    aria-label={
                      showAmNotifyDot(notifyUnread)
                        ? `Thông báo (${notifyUnread} chưa đọc)`
                        : 'Thông báo'
                    }
                    onClick={() => {
                      setNotifyOpen((prev) => !prev);
                      if (token) void loadNotifications(token);
                    }}
                  >
                    🔔
                    {showAmNotifyDot(notifyUnread) ? <span className="am-bell__dot" /> : null}
                  </button>
                  {notifyOpen ? (
                    <div className="am-bell__panel" role="dialog" aria-label="Thông báo Account Management">
                      <div className="am-bell__head">
                        <strong>Thông báo</strong>
                        <button type="button" className="am-btn" onClick={() => setNotifyOpen(false)}>
                          Đóng
                        </button>
                      </div>
                      <ul className="am-bell__list">
                        {notifyItems.length ? (
                          notifyItems.map((item) => (
                            <li key={item.id}>
                              {item.href ? (
                                <Link href={item.href} onClick={() => setNotifyOpen(false)}>
                                  {item.title}
                                </Link>
                              ) : (
                                <span>{item.title}</span>
                              )}
                            </li>
                          ))
                        ) : (
                          <li className="muted">Không có thông báo.</li>
                        )}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <AmCreateMenu canEdit={canEdit} />
              </header>
              <AmPalette
                open={paletteOpen}
                onOpen={() => setPaletteOpen(true)}
                onClose={() => setPaletteOpen(false)}
              />
              <div className="am-page">{children}</div>
            </div>
          </div>
        </AmPageContext.Provider>
      ) : null}
    </StaffPageShell>
  );
}

export function AmShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="muted">Đang tải…</p>}>
      <AmShellInner>{children}</AmShellInner>
    </Suspense>
  );
}
