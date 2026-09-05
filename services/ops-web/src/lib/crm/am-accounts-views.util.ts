import { hasCap, type StoredStaffUser } from '@/lib/auth';

export type AmAccountsViewId = 'all' | 'mine' | 'attention' | 'renewal90' | 'unassigned' | 'parent';

export type AmAccountsViewPreset = {
  id: AmAccountsViewId;
  label: string;
  query: Record<string, string>;
  requiresAssign?: boolean;
};

export const AM_ACCOUNT_VIEWS: AmAccountsViewPreset[] = [
  { id: 'all', label: 'Tất cả', query: {} },
  { id: 'mine', label: 'Của tôi', query: { owner: 'me' } },
  { id: 'attention', label: 'Cần chú ý', query: { band: 'at_risk,critical' } },
  { id: 'renewal90', label: 'Gia hạn 90 ngày', query: { sort: 'ends_on', ends_within: '90' } },
  { id: 'unassigned', label: 'Chưa gán owner', query: { owner: 'unassigned' }, requiresAssign: true },
  { id: 'parent', label: 'Parent group', query: { parent: '1' } },
];

const VIEW_PARAM_KEYS = ['owner', 'band', 'sort', 'ends_within', 'parent'] as const;
const KEEP_PARAM_KEYS = ['scope', 'q', 'team', 'lifecycle', 'industry'] as const;

export function canSeeUnassignedAccounts(user: StoredStaffUser | null | undefined): boolean {
  return (
    hasCap(user ?? null, 'crm_am', 'assign') ||
    hasCap(user ?? null, 'crm_am', 'view_all') ||
    hasCap(user ?? null, 'crm_am', 'manage')
  );
}

export function visibleAccountViews(user: StoredStaffUser | null | undefined): AmAccountsViewPreset[] {
  const allowUnassigned = canSeeUnassignedAccounts(user);
  return AM_ACCOUNT_VIEWS.filter((view) => !view.requiresAssign || allowUnassigned);
}

function fingerprint(search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of VIEW_PARAM_KEYS) {
    const value = search.get(key);
    if (value) out[key] = value;
  }
  return out;
}

function sameQuery(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

export function activeAccountView(search: URLSearchParams): AmAccountsViewId | null {
  const fp = fingerprint(search);
  const hit = AM_ACCOUNT_VIEWS.find((view) => sameQuery(view.query, fp));
  return hit?.id ?? null;
}

export function applyAccountView(
  current: URLSearchParams,
  view: AmAccountsViewPreset,
): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of KEEP_PARAM_KEYS) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(view.query)) {
    next.set(key, value);
  }
  return next;
}

export function accountCell(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function parentChildLabel(childCount: number, isParent: boolean): string | null {
  if (!isParent && childCount <= 0) return null;
  return `${childCount}`;
}
