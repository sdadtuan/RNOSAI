/**
 * Portal role helpers (UI side). Server is the source of truth: viewer ("Chỉ xem")
 * gets 403 `viewer_read_only` on every write; the UI only disables/hides the controls
 * so a viewer never hits that error in normal use.
 */
export const VIEWER_READ_ONLY_HINT = 'Tài khoản Chỉ xem — chỉ xem, không thay đổi được dữ liệu.';

export function isPortalReadOnly(role?: string | null): boolean {
  return role === 'viewer';
}

/** Owner-level tools (products, settings, sync, assign). Approver only. */
export function canManagePortal(role?: string | null): boolean {
  return role === 'approver';
}

/** Case actions: approver on any case; staff only on cases assigned to them; viewer never. */
export function canActOnCase(role: string | null | undefined, assigneeUserId: string | null | undefined, me: string | null | undefined): boolean {
  if (role === 'approver') return true;
  if (role === 'staff') return Boolean(me) && assigneeUserId === me;
  return false;
}
