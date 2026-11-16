/**
 * Lead lock — Sales confirmed "Sai số" (wrong number).
 *
 * Source flag: crm_leads.contact_status = 'invalid_contact' (set by the FR-SLA
 * "Đã xác minh đây là số sai" checkbox, GDKD mark-invalid, and the B2 "Ghi nhận sai số"
 * care report). A locked lead is hidden from everyone except Super Admin. Super Admin
 * can still view and mutate it; everyone else gets 404 on reads and 403 lead_locked
 * on writes. Auto-reassign jobs skip locked leads.
 */
export const LEAD_LOCKED_CONTACT_STATUS = 'invalid_contact';

export const LEAD_LOCKED_ERROR = 'lead_locked';

export const LEAD_LOCKED_MESSAGE_VI =
  'Lead đã khóa (Sai số) — chỉ Super Admin được chỉnh sửa hoặc chuyển lead này.';

export const LEAD_LOCKED_NOT_FOUND_MESSAGE_VI = 'Không tìm thấy lead hoặc bạn không có quyền xem.';

export function leadLockedSql(alias = 'l'): string {
  const col = alias ? `${alias}.contact_status` : 'contact_status';
  return `(COALESCE(${col}, '') = '${LEAD_LOCKED_CONTACT_STATUS}')`;
}

export function leadNotLockedSql(alias = 'l'): string {
  const col = alias ? `${alias}.contact_status` : 'contact_status';
  return `COALESCE(${col}, '') <> '${LEAD_LOCKED_CONTACT_STATUS}'`;
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
