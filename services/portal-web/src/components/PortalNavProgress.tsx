'use client';

import { useNavTransition, navPathsMatch } from '@/lib/portal/nav-transition';
import { usePathname } from 'next/navigation';

export function PortalNavProgress() {
  const { pending } = useNavTransition();
  const pathname = usePathname();
  const visible = Boolean(pending && !navPathsMatch(pathname, pending.href));
  if (!visible) return null;
  return (
    <div className="portal-nav-progress" role="progressbar" aria-label="Đang tải" aria-hidden="false">
      <div className="portal-nav-progress__bar" />
    </div>
  );
}
