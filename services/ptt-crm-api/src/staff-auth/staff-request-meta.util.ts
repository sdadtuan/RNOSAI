import type { IncomingHttpHeaders } from 'http';

export function staffClientIp(req: { ip?: string; headers: IncomingHttpHeaders }): string | null {
  const xff = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  if (xff) return xff.slice(0, 64);
  return req.ip ? String(req.ip).slice(0, 64) : null;
}

export function staffUserAgent(req: { headers: IncomingHttpHeaders }): string {
  return String(req.headers['user-agent'] ?? '').slice(0, 512);
}
