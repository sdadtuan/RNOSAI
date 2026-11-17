/**
 * Lead lock — hidden from every desk except Super Admin.
 *
 * - Sai số: contact_status = 'invalid_contact'
 * - Ẩn lead: contact_status = 'hidden_lead' (same hide/lock, distinct reason)
 *
 * Super Admin can still view and mutate. Everyone else gets 404 on reads and
 * 403 on writes. Lists, queues, search, and auto-reassign skip both statuses.
 */
export const LEAD_LOCKED_CONTACT_STATUS = 'invalid_contact';

export const LEAD_HIDDEN_CONTACT_STATUS = 'hidden_lead';

export const LEAD_LOCKED_CONTACT_STATUSES = [
  LEAD_LOCKED_CONTACT_STATUS,
  LEAD_HIDDEN_CONTACT_STATUS,
] as const;

export const LEAD_LOCKED_ERROR = 'lead_locked';

export const LEAD_HIDDEN_ERROR = 'lead_hidden';

export const LEAD_LOCKED_MESSAGE_VI =
  'Lead đã khóa (Sai số) — chỉ Super Admin được chỉnh sửa hoặc chuyển lead này.';

export const LEAD_HIDDEN_MESSAGE_VI =
  'Lead đã ẩn — chỉ Super Admin được xem hoặc chỉnh lead này.';

export const LEAD_LOCKED_NOT_FOUND_MESSAGE_VI = 'Không tìm thấy lead hoặc bạn không có quyền xem.';

function contactStatusCol(alias = 'l'): string {
  return alias ? `${alias}.contact_status` : 'contact_status';
}

function lockedStatusListSql(): string {
  return LEAD_LOCKED_CONTACT_STATUSES.map((status) => `'${status}'`).join(', ');
}

export function leadLockedSql(alias = 'l'): string {
  return `(COALESCE(${contactStatusCol(alias)}, '') IN (${lockedStatusListSql()}))`;
}

export function leadNotLockedSql(alias = 'l'): string {
  return `COALESCE(${contactStatusCol(alias)}, '') NOT IN (${lockedStatusListSql()})`;
}

/** 'hidden' | 'wrong_number' | '' — for badges. Distinct from the boolean lock. */
export function leadLockKindSql(alias = 'l'): string {
  const col = `COALESCE(${contactStatusCol(alias)}, '')`;
  return `CASE WHEN ${col} = '${LEAD_HIDDEN_CONTACT_STATUS}' THEN 'hidden' WHEN ${col} = '${LEAD_LOCKED_CONTACT_STATUS}' THEN 'wrong_number' ELSE '' END`;
}

const LOCK_EXEMPT_PREFIXES = ['/api/portal', '/api/v1/portal', '/portal', '/api/v1/auth', '/api/auth'];

export function isLeadLockExemptPath(pathname: string): boolean {
  const p = String(pathname || '').toLowerCase();
  return LOCK_EXEMPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

function pushId(out: Set<number>, raw: unknown): void {
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, 500)) pushId(out, item);
    return;
  }
  if (typeof raw !== 'number' && typeof raw !== 'string') return;
  const n = Number(String(raw).trim());
  if (Number.isSafeInteger(n) && n > 0) out.add(n);
}

const ID_KEYS = ['lead_id', 'leadId', 'lead_ids', 'leadIds', 'sqlite_lead_id'];

/** Lead ids referenced by an HTTP request (path /leads/:id, query and body id fields). */
export function leadIdsFromRequest(input: {
  path: string;
  query?: unknown;
  body?: unknown;
}): number[] {
  const out = new Set<number>();
  const re = /\/leads\/(\d+)(?=\/|$)/g;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(String(input.path || ''))) && guard < 10) {
    pushId(out, m[1]);
    guard += 1;
  }
  for (const src of [input.query, input.body]) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    const rec = src as Record<string, unknown>;
    for (const key of ID_KEYS) {
      if (key in rec) pushId(out, rec[key]);
    }
  }
  return [...out].slice(0, 500);
}
