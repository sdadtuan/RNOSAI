import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

/** Public (unauthenticated) routes. Everything else requires a session cookie. */
const PUBLIC_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/archived',
  '/p',
  '/proposals',
  '/video-review',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Authenticated aliases: resolve in middleware so the empty redirect page never paints. */
const PATH_REDIRECTS: Array<{ source: string; destination: string }> = [
  { source: '/crm/customers/leads', destination: '/crm/customers?source=lead' },
  { source: '/crm/customers/messages', destination: '/crm/customers?source=message' },
  { source: '/messages', destination: '/crm/messages' },
];

function redirectAlias(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const hit = PATH_REDIRECTS.find((r) => r.source === pathname);
  if (!hit) return null;
  const dest = new URL(hit.destination, request.nextUrl.origin);
  const destPathAndSearch = dest.pathname + dest.search;
  const hasSession = request.cookies.get(SESSION_COOKIE)?.value === '1';
  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', destPathAndSearch);
    return NextResponse.redirect(loginUrl);
  }
  const url = request.nextUrl.clone();
  url.pathname = dest.pathname;
  dest.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const aliased = redirectAlias(request);
  if (aliased) return aliased;
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }
  const hasSession = request.cookies.get(SESSION_COOKIE)?.value === '1';
  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|sw.js|robots.txt|manifest.webmanifest|capacitor-native-bridge.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|js|css|woff|woff2|map)$).*)',
  ],
};
