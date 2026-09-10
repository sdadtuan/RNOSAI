'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { CP_CREDIT_FOOTER_LABEL, CP_PRODUCT_NAME, CP_SEARCH_PLACEHOLDER } from '@/lib/crm/cp-copy';
import { CP_NAV, canSeeCpNav } from '@/lib/crm/cp-nav.util';
import { useCpCreditFooter } from '@/hooks/useCpCreditFooter';
import { CpScopeBar } from './CpScopeBar';

const COLLAPSE_KEY = 'cp-sidebar-collapsed';

function parseScope(raw: string | null): 'me' | 'team' | 'all' {
  if (raw === 'team' || raw === 'all') return raw;
  return 'me';
}

function navIsActive(pathname: string, href: string): boolean {
  if (href === '/crm/creative-os') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(user: StoredStaffUser): string {
  const name = user.display_name || user.email || '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function CpShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [syncLabel, setSyncLabel] = useState('');
  const credit = useCpCreditFooter(scope);

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

  useEffect(() => {
    const tick = () => {
      setSyncLabel(
        new Intl.DateTimeFormat('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date()),
      );
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const presetDays = useMemo<'30' | 'all'>(() => {
    const from = searchParams.get('from');
    if (!from) return 'all';
    return '30';
  }, [searchParams]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (loading && !user) {
    return (
      <div className="cp-app">
        <p className="cp-muted cp-app__loading">Đang tải Creative OS…</p>
      </div>
    );
  }

  if (!user || !canSeeCpNav(user)) return null;

  return (
    <div className="cp-app">
      <header className="cp-topbar">
        <Link className="cp-topbar__logo" href="/crm/creative-os">
          {CP_PRODUCT_NAME}
        </Link>
        <button type="button" className="cp-search-btn" aria-label={CP_SEARCH_PLACEHOLDER}>
          <span>{CP_SEARCH_PLACEHOLDER}</span>
          <kbd className="cp-kbd">⌘K</kbd>
        </button>
        <div className="cp-topbar__right">
          <span className="cp-fresh">Sync {syncLabel}</span>
          <button type="button" className="cp-icon-btn" aria-label="Thông báo">
            <span className="cp-dot" aria-hidden />
            🔔
          </button>
          <button
            type="button"
            className="cp-ava"
            aria-label="Tài khoản"
            title={user.display_name || user.email}
            onClick={logout}
          >
            {initials(user)}
          </button>
        </div>
      </header>

      <CpScopeBar user={user} presetDays={presetDays} />

      <div className={`cp-shell${collapsed ? ' cp-shell--collapsed' : ''}`}>
        <aside className="cp-sidebar" aria-label="Creative Production OS">
          <nav className="cp-sidebar__nav">
            <p className="cp-sidebar__grp">SẢN XUẤT</p>
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
            {collapsed ? null : (
              <>
                <b>{user.display_name || user.email}</b>
                <span className="cp-sidebar__credit">
                  {CP_CREDIT_FOOTER_LABEL}{' '}
                  {credit.loading ? '…' : `${credit.used}/${credit.limit}`}
                </span>
              </>
            )}
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
        <main className="cp-main">{children}</main>
      </div>
    </div>
  );
}

export function CpShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpShellInner>{children}</CpShellInner>
    </Suspense>
  );
}
