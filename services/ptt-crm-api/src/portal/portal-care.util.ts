export const PORTAL_RECEIVE_MINUTES = 15;
export const PORTAL_CARE_HOURS = 24;

export type PortalCareStatus = 'waiting_receive' | 'received' | 'caring' | 'purchased';

export type AdsChannel = { id: string; label: string; pageChannels: string[] };

const KNOWN: AdsChannel[] = [
  { id: 'meta', label: 'Meta', pageChannels: ['facebook'] },
  { id: 'google', label: 'Google', pageChannels: ['google'] },
  { id: 'tiktok', label: 'TikTok', pageChannels: ['tiktok'] },
  { id: 'zalo', label: 'Zalo', pageChannels: ['zalo'] },
];

export function adsChannelOf(raw: string | null | undefined): AdsChannel | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'meta' || value === 'facebook' || value === 'fb') return KNOWN[0];
  const known = KNOWN.find((item) => item.id === value);
  if (known) return known;
  return { id: value, label: value, pageChannels: [value] };
}

export type PortalClientPageLike = { channel: string; page_id: string; active: boolean };

/** Active client pages shown in CRM inbox; ad accounts stay for reporting only. */
export function filterVisiblePages<T extends PortalClientPageLike>(pages: T[]): T[] {
  return pages.filter((page) => page.active && page.channel !== 'ad_account');
}

export function visibleAdsChannels(rawChannels: Array<string | null | undefined>): AdsChannel[] {
  const seen = new Set<string>();
  const out: AdsChannel[] = [];
  for (const raw of rawChannels) {
    const channel = adsChannelOf(raw);
    if (!channel || seen.has(channel.id)) continue;
    seen.add(channel.id);
    out.push(channel);
  }
  return out;
}

export function nextAssignee(
  staffIds: string[],
  loads: Record<string, number>,
  current: string | null,
): string | null {
  const pool = current ? staffIds.filter((id) => id !== current) : staffIds.slice();
  if (!pool.length) return null;
  pool.sort((a, b) => (loads[a] ?? 0) - (loads[b] ?? 0) || a.localeCompare(b));
  return pool[0];
}

export function receiveDueAt(from: Date): Date {
  return new Date(from.getTime() + PORTAL_RECEIVE_MINUTES * 60_000);
}

export function careDueAt(from: Date): Date {
  return new Date(from.getTime() + PORTAL_CARE_HOURS * 60 * 60_000);
}

export function shouldHopReceive(status: string, dueAt: Date | null, now: Date): boolean {
  return status === 'waiting_receive' && dueAt != null && dueAt.getTime() <= now.getTime();
}

export function shouldHopCare(status: string, dueAt: Date | null, now: Date): boolean {
  return status === 'caring' && dueAt != null && dueAt.getTime() <= now.getTime();
}

export type PortalCareListFilter = {
  pageId?: string;
  day?: string;
  label?: string;
  kind?: string;
  /** When set (staff), SQL restricts to assignee_user_id = this user. Managers omit. */
  assigneeUserId?: string;
};

/**
 * Inbox visibility: staff only sees cases assigned to them; unassigned cases are manager-only (role !== 'staff').
 * Managers (approver/admin/owner/viewer) see every case for the tenant.
 */
export function careListFilterForUser(user: { role: string; sub: string }): Pick<PortalCareListFilter, 'assigneeUserId'> {
  if (user.role === 'staff') return { assigneeUserId: user.sub };
  return {};
}

export function staffCanViewCareCase(
  user: { role: string; sub: string },
  assigneeUserId: string | null,
): boolean {
  if (user.role !== 'staff') return true;
  return assigneeUserId === user.sub;
}

/** Appends `alias.assignee_user_id = $n` (or bare column when alias omitted) for staff list queries. */
export function appendAssigneeWhere(
  where: string[],
  values: unknown[],
  assigneeUserId?: string,
  tableAlias = 'c',
): void {
  if (!assigneeUserId) return;
  values.push(assigneeUserId);
  const col = tableAlias ? `${tableAlias}.assignee_user_id` : 'assignee_user_id';
  where.push(`${col} = $${values.length}::uuid`);
}

/** Same page + assignee visibility as the portal desk lists (does not delete old-page rows). */
export function filterCasesForPortalList<T extends { page_id: string; assignee_user_id: string | null }>(
  rows: T[],
  user: { role: string; sub: string },
  visiblePageIds: Iterable<string>,
): T[] {
  const pages = visiblePageIds instanceof Set ? visiblePageIds : new Set(visiblePageIds);
  return rows.filter((row) => pages.has(row.page_id) && staffCanViewCareCase(user, row.assignee_user_id));
}

export type InboxFlagInput = {
  kind: string;
  status: string;
  last_direction: string;
  last_inbound_at: string;
  last_read_at: string;
  received_at: string;
};

/** Unread / unreplied derived from last inbound, last_read_at, and existing care status. */
export function deriveInboxFlags(row: InboxFlagInput): { unread: boolean; unreplied: boolean } {
  const unreplied = row.kind === 'message' && row.last_direction === 'in';
  if (row.kind !== 'message' || !row.last_inbound_at) {
    return { unread: false, unreplied };
  }
  const inbound = Date.parse(row.last_inbound_at);
  if (!Number.isFinite(inbound)) return { unread: false, unreplied };
  if (row.last_read_at) {
    const readAt = Date.parse(row.last_read_at);
    return { unread: Number.isFinite(readAt) && inbound > readAt, unreplied };
  }
  if (row.status === 'waiting_receive') return { unread: true, unreplied };
  if (row.received_at) {
    const received = Date.parse(row.received_at);
    return { unread: Number.isFinite(received) && inbound > received, unreplied };
  }
  return { unread: false, unreplied };
}

const PHONE_RE = /(?:\+?84|0)[\s.-]*[1-9](?:[\s.-]*\d){8,9}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Display a VN mobile as 0xxxxxxxxx (strip +84 and separators). */
export function displayVnPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw.trim();
  let n = digits;
  if (n.startsWith('84') && n.length >= 11) n = `0${n.slice(2)}`;
  else if (!n.startsWith('0') && n.length >= 9) n = `0${n}`;
  return n;
}

export function extractContacts(text: string): { phones: string[]; emails: string[] } {
  const phones: string[] = [];
  const emails: string[] = [];
  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();
  const src = String(text ?? '');
  for (const match of src.match(PHONE_RE) ?? []) {
    const shown = displayVnPhone(match);
    if (shown.length >= 9 && !seenPhone.has(shown)) {
      seenPhone.add(shown);
      phones.push(shown);
    }
  }
  for (const match of src.match(EMAIL_RE) ?? []) {
    const email = match.toLowerCase();
    if (!seenEmail.has(email)) {
      seenEmail.add(email);
      emails.push(email);
    }
  }
  return { phones, emails };
}
