export const MSOS_NAV = [
  { screen: 'command', href: '/crm/media-os', label: 'Command Center', glyph: '▦' },
  { screen: 'inventory', href: '/crm/media-os/inventory', label: 'Inventory & Rate', glyph: '▣' },
  { screen: 'packages', href: '/crm/media-os/packages', label: 'Packages', glyph: '◫' },
  { screen: 'campaigns', href: '/crm/media-os/campaigns', label: 'Campaigns', glyph: '▶' },
  { screen: 'evidence', href: '/crm/media-os/evidence', label: 'Evidence', glyph: '▤' },
  { screen: 'outcomes', href: '/crm/media-os/outcomes', label: 'Outcomes', glyph: '⌁' },
  { screen: 'margin', href: '/crm/media-os/margin', label: 'Margin & Deal', glyph: '₫' },
  { screen: 'settings', href: '/crm/media-os/settings', label: 'Governance', glyph: '⚙' },
] as const;

export type MsosScreen = (typeof MSOS_NAV)[number]['screen'];

export const MSOS_REF_LINKS = [
  { href: '/crm/clients', label: 'CRM Client', glyph: '◉' },
  { href: '/crm/creative-os', label: 'Creative OS', glyph: '▣' },
  { href: '/crm/financials', label: 'Finance', glyph: '₫' },
] as const;

export function msosNavIsActive(pathname: string, href: string, screen: MsosScreen): boolean {
  if (screen === 'command') return pathname === '/crm/media-os' || pathname === '/crm/media-os/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function currentMsosNavLabel(pathname: string): string {
  const active = MSOS_NAV.find((item) => msosNavIsActive(pathname, item.href, item.screen));
  return active?.label ?? 'Command Center';
}
