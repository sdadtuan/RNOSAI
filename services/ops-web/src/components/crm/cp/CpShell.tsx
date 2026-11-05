'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  canViewImageSop,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { CP_CREDIT_FOOTER_LABEL } from '@/lib/crm/cp-copy';
import { getCpImageFlags } from '@/lib/crm/cp-image-sop-api';
import { visibleCpNav } from '@/lib/crm/cp-image-sop-nav.util';
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

function CpShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [imageEnabled, setImageEnabled] = useState(false);
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
    const token = getAccessToken();
    if (!token || !user) {
      setImageEnabled(false);
      return;
    }
    void getCpImageFlags(token)
      .then((flags) => setImageEnabled(flags.enabled))
      .catch(() => setImageEnabled(false));
  }, [user]);

  const navItems = useMemo(() => {
    if (!user) return CP_NAV;
    return visibleCpNav({
      items: CP_NAV,
      imageEnabled,
      canImgView: canViewImageSop(user),
    });
  }, [imageEnabled, user]);

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

  return (
    <StaffPageShell user={user} onLogout={logout} loading={loading && !user} width="full">
      {user && canSeeCpNav(user) ? (
        <div className={`cp-app cp-root${collapsed ? ' cp-shell--collapsed cp-root--collapsed' : ''}`}>
          <CpScopeBar user={user} presetDays={presetDays} />
          <div className={`cp-shell${collapsed ? ' cp-shell--collapsed' : ''}`}>
            <aside className="cp-sidebar" aria-label="Creative Production OS">
              <nav className="cp-sidebar__nav">
                <p className="cp-sidebar__grp">SẢN XUẤT SÁNG TẠO</p>
                {navItems.map((item) => (
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
                  <span className="cp-sidebar__credit">
                    {CP_CREDIT_FOOTER_LABEL}{' '}
                    {credit.loading ? '…' : `${credit.used}/${credit.limit}`}
                  </span>
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
