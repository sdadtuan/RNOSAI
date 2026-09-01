'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { staffMe } from '@/lib/api';
import {
  canAccessPath,
  type StaffRouteZone,
} from '@/lib/rbac-routes';
import {
  getAccessToken,
  getStoredUser,
  syncAuthCookie,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

type StaffRouteGuardProps = {
  children: React.ReactNode;
  zone: StaffRouteZone;
};

/**
 * Client cap guard (R1-S2): authenticated but missing caps → /403.
 * Login redirect is handled by middleware + missing token here.
 */
export function StaffRouteGuard({ children, zone }: StaffRouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const next =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : pathname;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    syncAuthCookie();

    void (async () => {
      let userForCap: StoredStaffUser | null = getStoredUser();
      if (pathname.startsWith('/crm/ceo')) {
        try {
          userForCap = await staffMe(token);
          updateStoredUser(userForCap);
        } catch {
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
      }

      if (!userForCap) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (!canAccessPath(pathname, userForCap, zone)) {
        router.replace(`/403?from=${encodeURIComponent(pathname)}`);
        return;
      }

      setAllowed(true);
    })();
  }, [pathname, router, zone]);

  if (!allowed) {
    return (
      <div className="route-guard-loading" aria-live="polite">
        <p className="muted">Đang kiểm tra quyền truy cập…</p>
      </div>
    );
  }

  return <>{children}</>;
}

/** Re-check caps after staffMe refresh (optional helper for pages). */
export function assertPathCap(user: StoredStaffUser | null, pathname: string, zone: StaffRouteZone): boolean {
  return canAccessPath(pathname, user, zone);
}
