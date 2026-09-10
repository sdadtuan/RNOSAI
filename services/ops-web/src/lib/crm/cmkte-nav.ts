export const CMKTE_NAV = [
  { screen: 'command', href: '/crm/content-os', label: 'Command Center', glyph: '▦' },
  { screen: 'requests', href: '/crm/content-os/requests', label: 'Content Requests', glyph: '◉' },
  { screen: 'workspace', href: '/crm/content-os/w/0', label: 'Production Workspace', glyph: '✦' },
  { screen: 'approvals', href: '/crm/content-os/approvals', label: 'Approval Center', glyph: '✓' },
  { screen: 'calendar', href: '/crm/content-os/calendar', label: 'Publication Control', glyph: '□' },
  { screen: 'library', href: '/crm/content-os/library', label: 'Brand & Asset Library', glyph: '▣' },
  { screen: 'intelligence', href: '/crm/content-os/intelligence', label: 'Content Intelligence', glyph: '◌' },
  { screen: 'settings', href: '/crm/content-os/settings', label: 'Governance Settings', glyph: '⚙' },
] as const;

export const CMKTE_LAST_ITEM_KEY = 'cmkte-last-item';

export function resolveCmktEWorkspaceHref(stored: string | null | undefined): string {
  const n = Number(stored);
  if (Number.isInteger(n) && n > 0) {
    return `/crm/content-os/w/${n}`;
  }
  return '/crm/content-os/w/0';
}
