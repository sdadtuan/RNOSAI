import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'host', 'content-length'];

function rewritePortalLocation(location: string, origin: string): string {
  if (location.startsWith('/')) return location;
  try {
    const portal = new URL(origin);
    const loc = new URL(location);
    const loopback = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.hostname === '::1';
    if (loopback && loc.port === portal.port) {
      return `${loc.pathname}${loc.search}${loc.hash}`;
    }
  } catch {
    return location;
  }
  return location;
}

function portalOrigin(): string {
  if (process.env.NODE_ENV === 'production') return '';
  return (process.env.PTT_PORTAL_DEV_ORIGIN ?? 'http://127.0.0.1:3100').trim().replace(/\/$/, '');
}

async function proxy(
  req: NextRequest,
  ctx: { params: { path?: string[] } },
): Promise<NextResponse> {
  const origin = portalOrigin();
  if (!origin) return new NextResponse(null, { status: 404 });

  const parts = ctx.params.path ?? [];
  const target = new URL(`${origin}/client${parts.length ? `/${parts.map(encodeURIComponent).join('/')}` : ''}`);
  target.search = req.nextUrl.search;

  const headers = new Headers(req.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  headers.delete('accept-encoding');

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return new NextResponse('Client CRM chưa chạy.', { status: 502 });
  }

  const out = new Headers(upstream.headers);
  for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) {
    out.delete(name);
  }
  const location = out.get('location');
  if (location) out.set('location', rewritePortalLocation(location, origin));

  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
