export type CmktEScreen =
  | 'command'
  | 'requests'
  | 'workspace'
  | 'approvals'
  | 'calendar'
  | 'library'
  | 'intelligence'
  | 'settings';

export function cmktePath(screen: CmktEScreen, itemId?: number): string {
  const root = '/crm/content-os';
  if (screen === 'command') return root;
  if (screen === 'workspace') return `${root}/w/${itemId}`;
  return `${root}/${screen}`;
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
