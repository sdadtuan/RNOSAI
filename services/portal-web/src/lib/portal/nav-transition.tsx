'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { portalPageTitle } from '@/lib/portal/nav';

export type NavPending = {
  href: string;
  title: string;
  startedAt: number;
} | null;

export type NavTransitionContextValue = {
  pending: NavPending;
  isPending: boolean;
  startNavigation: (href: string) => void;
  prefetch: (href: string) => void;
  prefetchAll: (hrefs: string[]) => void;
  displayPath: string;
};

const NavTransitionContext = createContext<NavTransitionContextValue | null>(null);

export function normalizeNavPath(href: string): string {
  if (!href) return '/';
  let path = href.split('?')[0].split('#')[0];
  if (path.startsWith('/client/')) path = path.slice('/client'.length);
  else if (path === '/client') path = '/';
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

export function navPathsMatch(pathname: string, href: string): boolean {
  const a = normalizeNavPath(pathname);
  const b = normalizeNavPath(href);
  return a === b;
}

export function navDestinationMeta(href: string): { href: string; title: string } {
  const path = normalizeNavPath(href);
  return { href: path, title: portalPageTitle(path) };
}

function writePendingAttrs(pending: NavPending) {
  if (typeof document === 'undefined') return;
  if (pending) {
    document.documentElement.setAttribute('data-nav-pending', '1');
    document.documentElement.setAttribute('data-nav-pending-href', pending.href);
  } else {
    document.documentElement.removeAttribute('data-nav-pending');
    document.documentElement.removeAttribute('data-nav-pending-href');
  }
}

export function NavTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<NavPending>(null);
  const [, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    if (pending && navPathsMatch(pathname, pending.href)) {
      setPending(null);
      writePendingAttrs(null);
    }
  }, [pathname, pending]);

  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => {
      setPending(null);
      writePendingAttrs(null);
    }, 15000);
    return () => window.clearTimeout(t);
  }, [pending]);

  const startNavigation = useCallback(
    (href: string) => {
      const path = normalizeNavPath(href);
      if (navPathsMatch(pathname, path) && !pendingRef.current) {
        return;
      }
      const next: NonNullable<NavPending> = {
        href: path,
        title: portalPageTitle(path),
        startedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      };
      // Urgent: must NOT be inside startTransition, or the highlight/title
      // would wait for the destination chunk the same way the old page did.
      setPending(next);
      writePendingAttrs(next);
      startTransition(() => {
        router.push(path);
      });
    },
    [pathname, router],
  );

  const prefetch = useCallback(
    (href: string) => {
      try {
        router.prefetch(normalizeNavPath(href));
      } catch {
        /* prefetch is best-effort */
      }
    },
    [router],
  );

  const prefetchAll = useCallback(
    (hrefs: string[]) => {
      hrefs.forEach((h) => prefetch(h));
    },
    [prefetch],
  );

  const displayPath = pending?.href ?? pathname;

  const value = useMemo<NavTransitionContextValue>(
    () => ({
      pending,
      isPending: Boolean(pending),
      startNavigation,
      prefetch,
      prefetchAll,
      displayPath,
    }),
    [pending, startNavigation, prefetch, prefetchAll, displayPath],
  );

  return <NavTransitionContext.Provider value={value}>{children}</NavTransitionContext.Provider>;
}

export function useNavTransition(): NavTransitionContextValue {
  const ctx = useContext(NavTransitionContext);
  const pathname = usePathname();
  const router = useRouter();
  if (ctx) return ctx;
  return {
    pending: null,
    isPending: false,
    startNavigation: (href: string) => {
      const path = normalizeNavPath(href);
      if (!navPathsMatch(pathname, path)) router.push(path);
    },
    prefetch: (href: string) => {
      try {
        router.prefetch(normalizeNavPath(href));
      } catch {
        /* ignore */
      }
    },
    prefetchAll: (hrefs: string[]) => {
      hrefs.forEach((h) => {
        try {
          router.prefetch(normalizeNavPath(h));
        } catch {
          /* ignore */
        }
      });
    },
    displayPath: pathname,
  };
}
