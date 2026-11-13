'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useNavTransition, navPathsMatch } from '@/lib/portal/nav-transition';
import { PortalRouteSkeleton } from '@/components/PortalRouteSkeleton';
import { PortalNavProgress } from '@/components/PortalNavProgress';

export function NavTransitionSlot({ children }: { children: ReactNode }) {
  const { pending } = useNavTransition();
  const pathname = usePathname();
  const showSkeleton = Boolean(pending && !navPathsMatch(pathname, pending.href));
  return (
    <>
      <PortalNavProgress />
      {showSkeleton ? (
        <PortalRouteSkeleton href={pending!.href} title={pending!.title} />
      ) : (
        children
      )}
    </>
  );
}
