export type RsMobileTabId = 'leads' | 'cskh' | 'chat' | 'tickets';

export const RS_MOBILE_TABS: ReadonlyArray<{
  id: RsMobileTabId;
  label: string;
  href: string;
  icon: RsMobileTabId;
}> = [
  { id: 'leads', label: 'Lead', href: '/crm/leads', icon: 'leads' },
  { id: 'cskh', label: 'CSKH', href: '/crm/cskh-board', icon: 'cskh' },
  { id: 'chat', label: 'Chat', href: '/crm/csd/chat', icon: 'chat' },
  { id: 'tickets', label: 'Ticket', href: '/crm/csd/tickets', icon: 'tickets' },
];

const TABS_BY_LENGTH = [...RS_MOBILE_TABS].sort((a, b) => b.href.length - a.href.length);

export function showRsMobileChrome(input: { width: number; search: string }): boolean {
  if (input.width >= 768) return false;
  const raw = input.search.startsWith('?') ? input.search.slice(1) : input.search;
  const shell = new URLSearchParams(raw).get('shell');
  if (shell === 'native' || shell === 'desktop') return false;
  return true;
}

export function rsMobileTabId(pathname: string): RsMobileTabId | null {
  const path = pathname.split('?')[0].split('#')[0];
  for (const tab of TABS_BY_LENGTH) {
    if (path === tab.href || path.startsWith(`${tab.href}/`)) return tab.id;
  }
  return null;
}
