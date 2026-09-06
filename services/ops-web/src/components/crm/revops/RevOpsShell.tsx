'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Suspense,
  createContext,
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
import { isRevopsRouteCatalogEnabled } from '@/lib/crm/revops-flags';
import {
  REVOPS_MOBILE_NAV,
  REVOPS_NAV_GROUPS,
  activeRevopsHref,
  canSeeRevopsNav,
} from '@/lib/crm/revops-nav.util';
import { RevOpsRouteCatalog } from './RevOpsRouteCatalog';
import { RevOpsModalsProvider } from './RevOpsModalsProvider';

export type RevopsPageContextValue = {
  user: StoredStaffUser;
  token: string;
};

const RevopsPageContext = createContext<RevopsPageContextValue | null>(null);

export function useRevopsPage(): RevopsPageContextValue {
  const ctx = useContext(RevopsPageContext);
  if (!ctx) {
    throw new Error('useRevopsPage must be used inside RevOpsShell');
  }
  return ctx;
}

const NAV_ICONS: Record<string, string> = {
  command: '◉',
  leads: '◎',
  pipeline: '▥',
  accounts: '◌',
  handover: '⇄',
  renewal: '↻',
  kpi: '◈',
  sla: '◷',
  reports: '▤',
  territory: '⌖',
  approvals: '✓',
  settings: '⚙',
};

function revopsRoleLabel(user: StoredStaffUser | null): string {
  if (hasCap(user, 'crm_revops', 'manage')) return 'Admin';
  if (hasCap(user, 'crm_revops', 'view_all')) return 'Director';
  if (hasCap(user, 'crm_revops', 'view_team')) return 'Manager';
  return 'Sales';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function titleFromPath(pathname: string, override?: string): string {
  if (override) return override;
  const href = activeRevopsHref(pathname);
  const item = REVOPS_NAV_GROUPS.flatMap((group) => group.items).find((nav) => nav.href === href);
  return item?.label ?? 'Command Center';
}

export function RevOpsShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

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
      if (!canSeeRevopsNav(me)) {
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

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await ensureAuth();
      setLoading(false);
    })();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const ctx = useMemo<RevopsPageContextValue | null>(() => {
    if (!user || !token) return null;
    return { user, token };
  }, [token, user]);

  const activeHref = activeRevopsHref(pathname);
  const crumbTitle = titleFromPath(pathname, title);
  const roleLabel = revopsRoleLabel(user);
  const showCatalog = isRevopsRouteCatalogEnabled();

  return (
    <StaffPageShell user={user} onLogout={logout} loading={loading && !user} width="full">
      {user && ctx ? (
        <RevopsPageContext.Provider value={ctx}>
          <Suspense fallback={null}>
            <RevOpsModalsProvider>
              <div className="revops-shell">
            <aside className="revops-sidebar" aria-label="Revenue Operations">
              <div className="revops-brand">
                <div className="revops-brand__logo" aria-hidden>
                  R
                </div>
                <div>
                  <strong>RNOSAI CRM</strong>
                  <small>Revenue Operations</small>
                </div>
              </div>
              <nav className="revops-nav" aria-label="Revenue Operations">
                {REVOPS_NAV_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="revops-nav__title">{group.title}</p>
                    {group.items.map((item) => {
                      const active = item.href === activeHref;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`revops-nav-item${active ? ' is-active' : ''}`}
                          aria-current={active ? 'page' : undefined}
                        >
                          <span className="revops-nav-item__icon" aria-hidden>
                            {NAV_ICONS[item.icon] ?? '•'}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="revops-userbox">
                <div className="revops-avatar" aria-hidden>
                  {initials(user.display_name || user.email)}
                </div>
                <div>
                  <b>{user.display_name || user.email}</b>
                  <small>{roleLabel}</small>
                </div>
              </div>
            </aside>
            <div className="revops-column">
              <header className="revops-topbar">
                <div className="revops-crumb">
                  RNOSAI CRM / Revenue Operations / {crumbTitle}
                </div>
                <div className="revops-top-actions">
                  <input
                    className="revops-search"
                    type="search"
                    placeholder="Tìm lead, account, deal..."
                    aria-label="Tìm lead, account, deal"
                  />
                  <button type="button" className="revops-iconbtn" aria-label="Tìm kiếm">
                    ⌕
                  </button>
                  <button type="button" className="revops-iconbtn" aria-label="Thông báo">
                    ♧
                  </button>
                  <div className="revops-avatar" aria-hidden>
                    {initials(user.display_name || user.email)}
                  </div>
                </div>
              </header>
              {showCatalog ? <RevOpsRouteCatalog pathname={pathname} /> : null}
              <div className="revops-page">
                {title || subtitle || actions ? (
                  <header className="revops-page-head">
                    <div>
                      {title ? <h1>{title}</h1> : null}
                      {subtitle ? <p>{subtitle}</p> : null}
                    </div>
                    {actions ? <div className="revops-page-actions">{actions}</div> : null}
                  </header>
                ) : null}
                {children}
              </div>
              <nav className="revops-mobile-nav" aria-label="Revenue Operations mobile">
                {REVOPS_MOBILE_NAV.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={active ? 'is-active' : undefined}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span aria-hidden>{NAV_ICONS[item.icon] ?? '•'}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            </div>
            </RevOpsModalsProvider>
          </Suspense>
        </RevopsPageContext.Provider>
      ) : null}
    </StaffPageShell>
  );
}
