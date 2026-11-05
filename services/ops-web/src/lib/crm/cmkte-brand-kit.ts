export type BrandKitCap = { section: string; action: string };

export const CREATIVE_OS_BRAND_KITS_HREF = '/crm/creative-os/brand-kits';

export function canOpenCreativeOsBrandKit(caps: BrandKitCap[] | null | undefined): boolean {
  return Boolean(caps?.some((cap) => cap.section === 'crm_cp' && cap.action === 'view'));
}
