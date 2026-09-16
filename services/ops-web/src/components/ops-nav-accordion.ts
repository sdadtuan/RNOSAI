import type { NavItem, NavParent } from './ops-nav-tree.types';

export type { NavChild, NavItem, NavLeaf, NavParent } from './ops-nav-tree.types';

export const NAV_ACCORDION_STORAGE_KEY = 'ops-nav-accordion-v2';

/** Same semantics as OpsNav.isActive */
export function isActiveHref(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Hub roots: exact only — prefix would swallow every nested module under them.
  if (href === '/' || href === '/crm') return false;
  if (href === '/crm/leads') {
    return (
      pathname === '/crm/leads' ||
      (pathname.startsWith('/crm/leads/') && !pathname.startsWith('/crm/leads/review-queue'))
    );
  }
  return pathname.startsWith(`${href}/`);
}

export function itemContainsPath(item: NavItem, pathname: string): boolean {
  if (item.kind === 'leaf') return isActiveHref(pathname, item.href);
  return item.children.some((child) => isActiveHref(pathname, child.href));
}

function parentIdsContainingPath(items: NavItem[], pathname: string): Set<string> {
  const keep = new Set<string>();
  for (const item of items) {
    if (item.kind === 'parent' && itemContainsPath(item, pathname)) {
      keep.add(item.id);
    }
  }
  return keep;
}

export function nextOpenIdsAfterToggle(args: {
  openIds: string[];
  toggledId: string;
  items: NavItem[];
  pathname: string;
}): string[] {
  const { openIds, toggledId, items } = args;
  const parentIds = new Set(
    items.filter((i): i is NavParent => i.kind === 'parent').map((i) => i.id),
  );
  if (!parentIds.has(toggledId)) return [...openIds];

  const currentlyOpen = openIds.includes(toggledId);

  if (currentlyOpen) {
    return openIds.filter((id) => id !== toggledId);
  }

  // Accordion: opening one parent closes the others (active route parent re-opens on navigate).
  return [toggledId];
}

export function ensureActiveParentOpen(
  openIds: string[],
  items: NavItem[],
  pathname: string,
): string[] {
  const keepActive = parentIdsContainingPath(items, pathname);
  if (keepActive.size === 0) return [...openIds];
  const next = new Set(openIds);
  for (const id of keepActive) next.add(id);
  return [...next];
}

export function readOpenIds(): string[] | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(NAV_ACCORDION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    return null;
  }
}

export function writeOpenIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NAV_ACCORDION_STORAGE_KEY, JSON.stringify(ids));
}
