'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { StaffPageShell } from '@/components/layout';
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

function cmkteNavIsActive(pathname: string, href: string, screen: string): boolean {
  if (screen === 'command') return pathname === '/crm/content-os' || pathname === '/crm/content-os/';
  if (screen === 'workspace') return pathname.startsWith('/crm/content-os/w/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentNavLabel(pathname: string): string {
  const active = CMKTE_NAV.find((item) => cmkteNavIsActive(pathname, item.href, item.screen));
  return active?.label ?? 'Command Center';
}

function CmktEShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceHref, setWorkspaceHref] = useState('/crm/content-os/w/0');

  const ensureAuth = useCallback(async () => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);

    async function finish(me: StoredStaffUser) {
      setUser(me);
      updateStoredUser(me);
      if (!canViewContentOs(me)) {
        router.replace(`/403?from=${encodeURIComponent(window.location.pathname)}`);
      }
    }

    try {
      await finish(await staffMe(access));
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      await finish(await staffMe(access));
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth().finally(() => setLoading(false));
  }, [ensureAuth]);

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

  const crumb = currentNavLabel(pathname);
  const flagOff = !isContentMarketingFeEnabled();

  return (
    <StaffPageShell user={user} onLogout={logout} loading={loading && !user} width="full">
      {user && canViewContentOs(user) ? (
        flagOff ? (
          <p className="cmkte-status">Module tắt</p>
        ) : (
          <div className="cmkte-root">
            <aside className="cmkte-side" aria-label="Content Marketing OS">
              <Link className="cmkte-brand" href="/crm/content-os">
                <span className="cmkte-mark" aria-hidden>
                  C
                </span>
                Content Marketing OS
              </Link>
              <div className="cmkte-workspace">
                <div className="cmkte-avatar">{user.display_name?.slice(0, 2).toUpperCase() || 'CM'}</div>
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
              <div className="cmkte-page">
                <p className="cmkte-crumb">
                  Content Marketing OS <span>/</span> <b>{crumb}</b>
                </p>
                {children}
              </div>
            </main>
          </div>
        )
      ) : null}
    </StaffPageShell>
  );
}

export function CmktEShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="cmkte-status">Đang tải Content Marketing OS…</p>}>
      <CmktEShellInner>{children}</CmktEShellInner>
    </Suspense>
  );
}
