import { ForbiddenException } from '@nestjs/common';

/**
 * Viewer ("Chỉ xem") accounts are strictly read-only on the server.
 * Every non-GET Portal request from a viewer is rejected with 403 `viewer_read_only`,
 * except a short allowlist of self-service writes that only touch the viewer's own
 * account or device (password, push/device registration, own notification read state,
 * and the case "read" ping which is a no-op for viewers).
 */
export const VIEWER_READ_ONLY_ERROR = 'viewer_read_only';
export const VIEWER_READ_ONLY_MESSAGE = 'Tài khoản Chỉ xem không được thay đổi dữ liệu.';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const VIEWER_SELF_SERVICE: RegExp[] = [
  /^\/api\/v1\/portal\/auth\/(change-password|refresh|logout)$/,
  /^\/api\/v1\/portal\/notifications\/(read-all|[^/]+\/read)$/,
  /^\/api\/v1\/portal\/push\/(subscribe|test)$/,
  /^\/api\/v1\/mobile\/(device-token|push\/test)$/,
  /^\/api\/portal\/crm\/cases\/[^/]+\/read$/,
];

function normalizePath(path: string): string {
  const bare = String(path ?? '').split('?')[0].split('#')[0] || '/';
  const collapsed = bare.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
}

/** True when this request must be refused because the caller is a viewer and it writes. */
export function viewerWriteBlocked(role: string | undefined, method: string | undefined, path: string | undefined): boolean {
  if (role !== 'viewer') return false;
  const verb = String(method ?? 'GET').toUpperCase();
  if (SAFE_METHODS.has(verb)) return false;
  const clean = normalizePath(String(path ?? ''));
  return !VIEWER_SELF_SERVICE.some((re) => re.test(clean));
}

export function viewerReadOnlyException(): ForbiddenException {
  return new ForbiddenException({ error: VIEWER_READ_ONLY_ERROR, message: VIEWER_READ_ONLY_MESSAGE });
}

/** Service-level guard (defence in depth for code paths reached without the HTTP guard). */
export function assertNotViewer(user: { role?: string }): void {
  if (user.role === 'viewer') throw viewerReadOnlyException();
}
