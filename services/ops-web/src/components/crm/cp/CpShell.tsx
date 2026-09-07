'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { CP_NAV, canSeeCpNav } from '@/lib/crm/cp-nav.util';

const COLLAPSE_KEY = 'cp-sidebar-collapsed';

function parseScope(raw: string | null): 'me' | 'team' | 'all' {
  if (raw === 'team' || raw === 'all') return raw;
  return 'me';
}

function navIsActive(pathname: string, href: string): boolean {
  if (href === '/crm/creative-os') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CpShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

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
      if (!canSeeCpNav(me)) {
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
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  useEffect(() => {
    void ensureAuth().finally(() => setLoading(false));
  }, [ensureAuth]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  function changeScope(next: 'me' | 'team' | 'all') {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'me') params.delete('scope');
    else params.set('scope', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={loading && !user} width="full">
      {user && canSeeCpNav(user) ? (
        <div className={`cp-root${collapsed ? ' cp-root--collapsed' : ''}`}>
          <aside className="cp-sidebar" aria-label="Creative Production OS">
            <nav className="cp-sidebar__nav">
              {CP_NAV.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`cp-sidebar__link${
                    navIsActive(pathname, item.href) ? ' cp-sidebar__link--active' : ''
                  }`}
                  title={item.label}
                >
                  {collapsed ? item.label.slice(0, 1) : item.label}
                </Link>
              ))}
            </nav>
            <div className="cp-sidebar__foot">
              {collapsed ? null : <b>{user.display_name || user.email}</b>}
              <button
                type="button"
                className="cp-sidebar__collapse"
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              >
                {collapsed ? '»' : '« Thu gọn'}
              </button>
            </div>
          </aside>
          <div className="cp-column">
            <header className="cp-top">
              <strong className="cp-product-name">Creative Production OS</strong>
              <label className="cp-scope">
                <span>Phạm vi</span>
                <select
                  value={scope}
                  onChange={(event) => changeScope(parseScope(event.target.value))}
                  aria-label="Phạm vi"
                >
                  <option value="me">Của tôi</option>
                  <option value="team">Team</option>
                  <option value="all">Toàn bộ</option>
                </select>
              </label>
            </header>
            <div className="cp-main">{children}</div>
          </div>
        </div>
      ) : null}
    </StaffPageShell>
  );
}

export function CpShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpShellInner>{children}</CpShellInner>
    </Suspense>
  );
}
