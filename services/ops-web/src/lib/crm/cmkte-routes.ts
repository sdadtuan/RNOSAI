export type CmktEScreen =
  | 'command'
  | 'requests'
  | 'workspace'
  | 'approvals'
  | 'calendar'
  | 'library'
  | 'intelligence'
  | 'settings';

export type CmktPathOpts = {
  itemId?: number;
  lifecycleId?: number;
};

export function withLifecycleQuery(href: string, lifecycleId?: number): string {
  if (!(lifecycleId && lifecycleId > 0)) return href;
  const hashIdx = href.indexOf('#');
  const withoutHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : '';
  const sep = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${sep}lifecycle=${lifecycleId}${hash}`;
}

export function cmktePath(screen: CmktEScreen, arg?: number | CmktPathOpts): string {
  const itemId = typeof arg === 'number' ? arg : arg?.itemId;
  const lifecycleId = typeof arg === 'number' ? undefined : arg?.lifecycleId;
  const root = '/crm/content-os';
  let path: string;
  if (screen === 'command') path = root;
  else if (screen === 'workspace') path = `${root}/w/${itemId}`;
  else path = `${root}/${screen}`;
  return withLifecycleQuery(path, lifecycleId);
}

export function legacyContentOsRedirect(lifecycleId: number): string {
  return `/crm/content-os?lifecycle=${lifecycleId}`;
}

export function contentOsPanelHref(lifecycleId: number): string {
  return `/crm/service-delivery/${lifecycleId}?tab=content-os-panel`;
}

export function resolveServiceDeliveryContentOsTab(
  tab: string | null,
): 'cos-shell' | 'panel' | null {
  if (tab === 'content-os') return 'cos-shell';
  if (tab === 'content-os-panel') return 'panel';
  return null;
}
