export function parseLifecycleIdQuery(raw: string | null): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return undefined;
  return n;
}

export function withVdLifecycleQuery(href: string, lifecycleId?: number): string {
  if (!(lifecycleId && lifecycleId > 0)) return href;
  const hashIdx = href.indexOf('#');
  const withoutHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : '';
  const sep = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${sep}lifecycle_id=${lifecycleId}${hash}`;
}

export type VdSopScreen =
  | 'command'
  | 'projects'
  | 'workspace'
  | 'gates'
  | 'dashboard'
  | 'library'
  | 'admin';

export function vdSopPath(
  screen: VdSopScreen,
  opts?: { lifecycleId?: number; projectId?: number },
): string {
  const lifecycleId = opts?.lifecycleId;
  const projectId = opts?.projectId;
  if (screen === 'admin') return '/admin/video/providers';
  if (screen === 'command') return withVdLifecycleQuery('/crm/video', lifecycleId);
  if (screen === 'projects') return withVdLifecycleQuery('/crm/video#projects', lifecycleId);
  if (screen === 'dashboard') {
    return withVdLifecycleQuery('/crm/video/dashboard', lifecycleId);
  }
  if (screen === 'workspace') {
    const id = projectId && projectId > 0 ? projectId : 0;
    const base = id > 0 ? `/crm/video/${id}` : '/crm/video';
    return withVdLifecycleQuery(base, lifecycleId);
  }
  if (screen === 'gates') {
    const id = projectId && projectId > 0 ? projectId : 0;
    const base = id > 0 ? `/crm/video/${id}/gates/1` : '/crm/video';
    return withVdLifecycleQuery(base, lifecycleId);
  }
  if (screen === 'library') {
    const id = projectId && projectId > 0 ? projectId : 0;
    const base = id > 0 ? `/crm/video/${id}/library` : '/crm/video';
    return withVdLifecycleQuery(base, lifecycleId);
  }
  return withVdLifecycleQuery('/crm/video', lifecycleId);
}

export function contentBoardHref(lifecycleId?: number): string {
  if (lifecycleId && lifecycleId > 0) {
    return `/crm/content-os?lifecycle=${lifecycleId}`;
  }
  return '/crm/content-os';
}
