'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { canViewImageSop, getAccessToken, getStoredUser } from '@/lib/auth';
import { getCpImageFlags } from '@/lib/crm/cp-image-sop-api';
import { isCpImageSopNavEnabled } from '@/lib/crm/cp-image-sop.flags';
import {
  CP_IMAGE_NAV,
  cpImageActiveNavId,
  cpImageNavIsActive,
} from '@/lib/crm/cp-image-sop-nav.util';

export function CpImageShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const activeId = cpImageActiveNavId(pathname);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const checkAccess = useCallback(async () => {
    const user = getStoredUser();
    const token = getAccessToken();
    if (!user || !token || !canViewImageSop(user)) {
      setAllowed(false);
      setReady(true);
      router.replace(`/403?from=${encodeURIComponent(pathname)}`);
      return;
    }
    const flags = await getCpImageFlags(token).catch(() => ({ enabled: false, router: 'manual' as const }));
    if (!isCpImageSopNavEnabled(flags)) {
      setAllowed(false);
      setReady(true);
      router.replace('/crm/creative-os');
      return;
    }
    setAllowed(true);
    setReady(true);
  }, [pathname, router]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  if (!ready) {
    return <p className="cp-muted">Đang tải ImageOS…</p>;
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="cp-img-shell">
      <aside className="cp-img-subsidebar" aria-label="ImageOS Command">
        <h2 className="cp-img-subsidebar__title">ImageOS · Command</h2>
        <nav className="cp-img-subnav">
          {CP_IMAGE_NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={
                item.id === activeId || cpImageNavIsActive(pathname, item.href)
                  ? 'cp-img-subnav__link cp-img-subnav__link--on'
                  : 'cp-img-subnav__link'
              }
            >
              <span>{item.label}</span>
              <span className="cp-img-subnav__code">{item.screen}</span>
            </Link>
          ))}
        </nav>
        <div className="cp-img-subfoot">
          <b>Enterprise posture</b>
          Policy coverage · Provenance · WATCH alerts — từ{' '}
          <code>GET /image/governance/summary</code>
        </div>
      </aside>
      <div className="cp-img-main">{children}</div>
    </div>
  );
}
