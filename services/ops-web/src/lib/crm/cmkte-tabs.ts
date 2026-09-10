export const CMKTE_TABS = [
  { id: 'brief', label: '1. Brief & Strategy' },
  { id: 'architecture', label: '2. Content Architecture' },
  { id: 'copy', label: '3. Copy Studio' },
  { id: 'assets', label: '4. Assets, DAM & Rights' },
  { id: 'seo', label: '5. SEO & Distribution' },
  { id: 'production', label: '6. Production Plan' },
  { id: 'approvaltab', label: '7. Approval & Governance' },
  { id: 'publish', label: '8. Publish Control' },
] as const;

export type CmktETabId = (typeof CMKTE_TABS)[number]['id'];

const NEXT_TAB_LABEL: Record<CmktETabId, string> = {
  brief: 'Content Architecture',
  architecture: 'Copy Studio',
  copy: 'Assets, DAM & Rights',
  assets: 'SEO & Distribution',
  seo: 'Production Plan',
  production: 'Approval & Governance',
  approvaltab: 'Publish Control',
  publish: 'Send to approval',
};

export function nextTabLabel(id: CmktETabId): string {
  return NEXT_TAB_LABEL[id];
}

export function parseCmktETab(raw: string | null | undefined): CmktETabId | undefined {
  if (!raw) return undefined;
  return CMKTE_TABS.some((tab) => tab.id === raw) ? (raw as CmktETabId) : undefined;
}

export const CMKTE_EMPTY_ITEM = 'Chọn item từ Requests / Command Center';
