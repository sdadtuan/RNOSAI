'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  canViewMediaOs,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  currentMsosNavLabel,
  MSOS_NAV,
  MSOS_REF_LINKS,
  msosNavIsActive,
} from '@/lib/crm/msos-nav';
import { isMediaOsFeEnabled } from '@/lib/media-os-flags';

function initials(user: StoredStaffUser): string {
  const name = user.display_name || user.email || '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function MsosShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      if (!canViewMediaOs(me)) {
        setError('Không có quyền Media OS');
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
        if (!canViewMediaOs(me)) {
          setError('Không có quyền Media OS');
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

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (loading && !user) {
    return (
      <div className="msos-app">
        <p className="msos-app__loading">Đang tải Media OS…</p>
      </div>
    );
  }

  const denied = !user || !canViewMediaOs(user);
  const flagOff = !isMediaOsFeEnabled();
  const crumb = currentMsosNavLabel(pathname);

  return (
    <div className="msos-app">
      <aside className="msos-side" aria-label="Media OS">
        <Link className="msos-brand" href="/crm/media-os">
          <span className="msos-mark" aria-hidden>
            M
          </span>
          Media OS
        </Link>
        <div className="msos-workspace">
          <div className="msos-avatar">{user ? initials(user) : 'MS'}</div>
          <div>
            <small>WORKSPACE</small>
            <b>PTT Agency Vietnam</b>
          </div>
        </div>
        <div className="msos-label">MEDIA OS</div>
        <nav className="msos-nav">
          {MSOS_NAV.map((item) => {
            const active = msosNavIsActive(pathname, item.href, item.screen);
            return (
              <Link
                key={item.screen}
                href={item.href}
                className={active ? 'msos-nav__link--active' : undefined}
              >
                <span className="msos-ic" aria-hidden>
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="msos-label">THAM CHIẾU — KHÔNG SỞ HỮU</div>
        <nav className="msos-nav">
          {MSOS_REF_LINKS.map((item) => (
            <Link key={item.href} href={item.href}>
              <span className="msos-ic" aria-hidden>
                {item.glyph}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="msos-help">
          <b>Media Supply &amp; Outcome OS</b>
          <p>
            MSOS sở hữu inventory, package, IO và evidence pack. Client / Lead / Invoice chỉ
            deep-link.
          </p>
        </div>
      </aside>
      <main className="msos-main">
        <header className="msos-top">
          <div className="msos-crumb">
            Media OS <span>/</span> <b>{crumb}</b>
          </div>
          <label className="msos-search">
            ⌕
            <input type="search" placeholder="IO, placement, media line, evidence pack…" />
          </label>
          <button
            type="button"
            className="msos-topav"
            aria-label="Tài khoản"
            title={user?.display_name || user?.email || 'Tài khoản'}
            onClick={logout}
          >
            {user ? initials(user) : 'MS'}
          </button>
        </header>
        <div className="msos-page">
          {denied ? (
            <p className="msos-status msos-status--error">{error || 'Không có quyền Media OS'}</p>
          ) : null}
          {!denied && flagOff ? <p className="msos-status">Media OS chưa bật</p> : null}
          {!denied && !flagOff ? children : null}
        </div>
      </main>
    </div>
  );
}
