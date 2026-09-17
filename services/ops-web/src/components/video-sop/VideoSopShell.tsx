'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { StaffPageShell } from '@/components/layout';
import {
  clearSession,
  getStoredUser,
  hasCap,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  VD_SOP_LAST_PROJECT_KEY,
  VD_SOP_NAV,
  resolveVdGateHref,
  resolveVdLibraryHref,
  resolveVdWorkspaceHref,
} from '@/lib/crm/video-sop-nav';
import { parseLifecycleIdQuery, withVdLifecycleQuery } from '@/lib/crm/video-sop-routes';
import { ensureStaffAccessToken } from '@/lib/crm/staff-session';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function vdNavIsActive(pathname: string, screen: string): boolean {
  if (screen === 'command' || screen === 'projects') {
    return pathname === '/crm/video' || pathname === '/crm/video/';
  }
  if (screen === 'workspace') {
    return /^\/crm\/video\/\d+$/.test(pathname);
  }
  if (screen === 'gates') {
    return /\/crm\/video\/\d+\/gates(?:\/|$)/.test(pathname);
  }
  if (screen === 'dashboard') {
    return pathname === '/crm/video/dashboard' || pathname.startsWith('/crm/video/dashboard/');
  }
  if (screen === 'library') {
    return /\/crm\/video\/\d+\/library(?:\/|$)/.test(pathname);
  }
  if (screen === 'admin') {
    return pathname.startsWith('/admin/video/providers');
  }
  return false;
}

function currentNavLabel(pathname: string): string {
  const active = VD_SOP_NAV.find((item) => vdNavIsActive(pathname, item.screen));
  return active?.label ?? 'Command Center';
}

function initials(user: StoredStaffUser): string {
  const name = user.display_name || user.email || 'VD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function VideoSopShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const lifecycleId = parseLifecycleIdQuery(searchParams.get('lifecycle_id'));
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [storedProject, setStoredProject] = useState<string | null>(null);

  const ensureAuth = useCallback(async () => {
    const cached = getStoredUser();
    if (cached) setUser(cached);
    const out = await ensureStaffAccessToken();
    if (out.cleared || !out.token || !out.user) {
      router.replace('/login');
      return;
    }
    setUser(out.user);
    if (!canViewVideoSop(out.user)) {
      router.replace(`/403?from=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth().finally(() => setLoading(false));
  }, [ensureAuth]);

  useEffect(() => {
    const match = pathname.match(/^\/crm\/video\/(\d+)(?:\/|$)/);
    const routeId = match?.[1];
    if (routeId && Number(routeId) > 0) {
      window.localStorage.setItem(VD_SOP_LAST_PROJECT_KEY, routeId);
      setStoredProject(routeId);
      return;
    }
    setStoredProject(window.localStorage.getItem(VD_SOP_LAST_PROJECT_KEY));
  }, [pathname]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const crumb = currentNavLabel(pathname);
  const flagOff = !isVideoSopEnabled();
  const scopedHref = (href: string, screen: string) =>
    screen === 'admin' ? href : withVdLifecycleQuery(href, lifecycleId);

  function navHref(screen: string, href: string): string {
    if (screen === 'workspace') {
      return scopedHref(resolveVdWorkspaceHref(storedProject), screen);
    }
    if (screen === 'gates') {
      return scopedHref(resolveVdGateHref(storedProject), screen);
    }
    if (screen === 'library') {
      return scopedHref(resolveVdLibraryHref(storedProject), screen);
    }
    return scopedHref(href, screen);
  }

  const ops = VD_SOP_NAV.filter((item) => item.group === 'ops');
  const libs = VD_SOP_NAV.filter((item) => item.group === 'libs');

  return (
    <StaffPageShell user={user} onLogout={logout} loading={loading && !user} width="full">
      {user && canViewVideoSop(user) ? (
        flagOff ? (
          <p className="vd-empty">Module tắt</p>
        ) : (
          <div className="vd-shell">
            <aside className="vd-sidebar" aria-label="Video SOP">
              <Link className="vd-brand" href={scopedHref('/crm/video', 'command')}>
                <span className="vd-mark" aria-hidden>
                  V
                </span>
                <span className="vd-brand__text">
                  <strong>Video SOP</strong>
                  <small>Video Operations</small>
                </span>
              </Link>
              <div className="vd-workspace">
                <div className="vd-avatar">{initials(user)}</div>
                <div>
                  <small>WORKSPACE</small>
                  <b>Video Operations</b>
                </div>
              </div>
              <div className="vd-label">VIDEO OPERATIONS</div>
              <nav className="vd-nav">
                {ops.map((item) => {
                  const href = navHref(item.screen, item.href);
                  const active = vdNavIsActive(pathname, item.screen);
                  return (
                    <Link
                      key={item.screen}
                      href={href}
                      className={active ? 'vd-nav__link--active' : undefined}
                    >
                      <span className="vd-ic" aria-hidden>
                        {item.glyph}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="vd-label">LIBRARIES & ADMIN</div>
              <nav className="vd-nav">
                {libs.map((item) => {
                  const href = navHref(item.screen, item.href);
                  const active = vdNavIsActive(pathname, item.screen);
                  return (
                    <Link
                      key={item.screen}
                      href={href}
                      className={active ? 'vd-nav__link--active' : undefined}
                    >
                      <span className="vd-ic" aria-hidden>
                        {item.glyph}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="vd-help">
                <b>Video Ops</b>
                <p>Brief → script → gate → render theo lifecycle. Mở Command Center để chọn project.</p>
              </div>
            </aside>
            <div className="vd-column">
              <header className="vd-topbar">
                <div className="vd-crumb">
                  Video SOP / <b>{crumb}</b>
                </div>
              </header>
              {children}
            </div>
          </div>
        )
      ) : null}
    </StaffPageShell>
  );
}

export function VideoSopShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="vd-status">Đang tải Video SOP…</p>}>
      <VideoSopShellInner>{children}</VideoSopShellInner>
    </Suspense>
  );
}
