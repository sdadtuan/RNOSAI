export const VD_SOP_LAST_PROJECT_KEY = 'vd-sop-last-project';

export const VD_SOP_NAV = [
  { screen: 'command', href: '/crm/video', label: 'Command Center', glyph: '▦', group: 'ops' },
  { screen: 'projects', href: '/crm/video#projects', label: 'Projects', glyph: '☰', group: 'ops' },
  { screen: 'workspace', href: '/crm/video/0', label: 'Production Workspace', glyph: '✦', group: 'ops' },
  { screen: 'gates', href: '/crm/video/0/gates/1', label: 'Gate Center', glyph: '✓', group: 'ops' },
  { screen: 'dashboard', href: '/crm/video/dashboard', label: 'Production Dashboard', glyph: '▣', group: 'ops' },
  { screen: 'library', href: '/crm/video/0/library', label: 'Asset Library', glyph: '◻', group: 'libs' },
  { screen: 'admin', href: '/admin/video/providers', label: 'Admin providers', glyph: '⚙', group: 'libs' },
] as const;

function positiveId(stored: string | null | undefined): number | undefined {
  const n = Number(stored);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function resolveVdWorkspaceHref(stored: string | null | undefined): string {
  const id = positiveId(stored);
  return id ? `/crm/video/${id}` : '/crm/video';
}

export function resolveVdGateHref(stored: string | null | undefined): string {
  const id = positiveId(stored);
  return id ? `/crm/video/${id}/gates/1` : '/crm/video';
}

export function resolveVdLibraryHref(stored: string | null | undefined): string {
  const id = positiveId(stored);
  return id ? `/crm/video/${id}/library` : '/crm/video';
}
