'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  canViewContentOs,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import {
  CMKTE_LAST_ITEM_KEY,
  CMKTE_NAV,
  resolveCmktEWorkspaceHref,
} from '@/lib/crm/cmkte-nav';

const OPS_SCREENS = new Set(['command', 'requests', 'workspace', 'approvals', 'calendar']);

function initials(user: StoredStaffUser): string {
  const name = user.display_name || user.email || '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function cmkteNavIsActive(pathname: string, href: string, screen: string): boolean {
  if (screen === 'command') return pathname === '/crm/content-os' || pathname === '/crm/content-os/';
  if (screen === 'workspace') return pathname.startsWith('/crm/content-os/w/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentNavLabel(pathname: string): string {
  const active = CMKTE_NAV.find((item) => cmkteNavIsActive(pathname, item.href, item.screen));
  return active?.label ?? 'Command Center';
}

export function CmktEShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspaceHref, setWorkspaceHref] = useState('/crm/content-os/w/0');

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewContentOs(me)) {
        setError('Không có quyền Content Marketing OS');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        access = out.access_token;
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        if (!canViewContentOs(me)) {
          setError('Không có quyền Content Marketing OS');
          return null;
        }
        return access;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        await ensureAuth();
      } catch {
        clearSession();
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, router]);

  useEffect(() => {
    const match = pathname.match(/^\/crm\/content-os\/w\/(\d+)$/);
    const routeId = match?.[1];
    if (routeId && Number(routeId) > 0) {
      window.localStorage.setItem(CMKTE_LAST_ITEM_KEY, routeId);
      setWorkspaceHref(`/crm/content-os/w/${routeId}`);
      return;
    }
    setWorkspaceHref(resolveCmktEWorkspaceHref(window.localStorage.getItem(CMKTE_LAST_ITEM_KEY)));
  }, [pathname]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (loading && !user) {
    return (
      <div className="cmkte-app">
        <p className="cmkte-app__loading">Đang tải Content Marketing OS…</p>
      </div>
    );
  }

  const denied = !user || !canViewContentOs(user);
  const flagOff = !isContentMarketingFeEnabled();
  const crumb = currentNavLabel(pathname);

  return (
    <div className="cmkte-app">
      <aside className="cmkte-side" aria-label="Content Marketing OS">
        <Link className="cmkte-brand" href="/crm/content-os">
          <span className="cmkte-mark" aria-hidden>
            C
          </span>
          Content Marketing OS
        </Link>
        <div className="cmkte-workspace">
          <div className="cmkte-avatar">{user ? initials(user) : 'CM'}</div>
          <div>
            <small>WORKSPACE</small>
            <b>Content Operations</b>
          </div>
        </div>
        <div className="cmkte-label">CONTENT OPERATIONS</div>
        <nav className="cmkte-nav">
          {CMKTE_NAV.filter((item) => OPS_SCREENS.has(item.screen)).map((item) => {
            const href = item.screen === 'workspace' ? workspaceHref : item.href;
            const active = cmkteNavIsActive(pathname, item.href, item.screen);
            return (
              <Link
                key={item.screen}
                href={href}
                className={active ? 'cmkte-nav__link--active' : undefined}
              >
                <span className="cmkte-ic" aria-hidden>
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="cmkte-label">LIBRARIES & INSIGHT</div>
        <nav className="cmkte-nav">
          {CMKTE_NAV.filter((item) => !OPS_SCREENS.has(item.screen)).map((item) => {
            const active = cmkteNavIsActive(pathname, item.href, item.screen);
            return (
              <Link
                key={item.screen}
                href={item.href}
                className={active ? 'cmkte-nav__link--active' : undefined}
              >
                <span className="cmkte-ic" aria-hidden>
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="cmkte-help">
          <b>Content Ops Assistant</b>
          <p>Theo dõi SLA, quyền asset và xung đột lịch phát hành trên toàn portfolio.</p>
          <button type="button">Mở trợ lý →</button>
        </div>
      </aside>
      <main className="cmkte-main">
        <header className="cmkte-top">
          <div className="cmkte-crumb">
            Content Marketing OS <span>/</span> <b>{crumb}</b>
          </div>
          <label className="cmkte-search">
            ⌕
            <input type="search" placeholder="Tìm content ID, client, campaign, asset..." />
          </label>
          <button type="button" className="cmkte-topbtn" aria-label="Thông báo">
            ◔
          </button>
          <button
            type="button"
            className="cmkte-topav"
            aria-label="Tài khoản"
            title={user?.display_name || user?.email || 'Tài khoản'}
            onClick={logout}
          >
            {user ? initials(user) : 'CM'}
          </button>
        </header>
        <div className="cmkte-page">
          {denied ? <p className="cmkte-status cmkte-status--error">{error || 'Không có quyền Content Marketing OS'}</p> : null}
          {!denied && flagOff ? <p className="cmkte-status">Module tắt</p> : null}
          {!denied && !flagOff ? children : null}
        </div>
      </main>
    </div>
  );
}
