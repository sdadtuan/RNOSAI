import type { CpNavItem } from './cp-nav.util';

export const CP_IMAGE_NAV = [
  { id: 'home', href: '/crm/creative-os/image', label: 'Tổng quan', screen: 'IMG-01' },
  { id: 'tasks', href: '/crm/creative-os/image/operations', label: 'Vận hành sáng tạo', screen: 'IMG-02' },
  { id: 'jobs', href: '/crm/creative-os/image/jobs', label: 'Image Jobs', screen: 'IMG-03' },
  { id: 'assets', href: '/crm/creative-os/image/assets', label: 'Asset Intelligence', screen: 'IMG-04' },
  { id: 'review', href: '/crm/creative-os/image/review', label: 'Review & Approval', screen: 'IMG-05' },
  { id: 'sops', href: '/crm/creative-os/image/sops', label: 'SOP Registry', screen: 'IMG-06' },
  { id: 'composer', href: '/crm/creative-os/image/sops/new', label: 'SOP Composer', screen: 'IMG-07' },
  { id: 'brand', href: '/crm/creative-os/image/brand', label: 'Brand Graph', screen: 'IMG-08' },
  { id: 'providers', href: '/crm/creative-os/image/providers', label: 'Provider Router', screen: 'IMG-09' },
  { id: 'finops', href: '/crm/creative-os/image/finops', label: 'AI FinOps', screen: 'IMG-10' },
  { id: 'governance', href: '/crm/creative-os/image/governance', label: 'Governance', screen: 'IMG-11' },
] as const;

export type CpImageNavId = (typeof CP_IMAGE_NAV)[number]['id'];

export function visibleCpNav(input: {
  items: CpNavItem[];
  imageEnabled: boolean;
  canImgView: boolean;
}): CpNavItem[] {
  const showImage = input.imageEnabled && input.canImgView;
  return input.items.filter((item) => item.id !== 'image' || showImage);
}

export function cpImageNavIsActive(pathname: string, href: string): boolean {
  if (href === '/crm/creative-os/image') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function cpImageActiveNavId(pathname: string): CpImageNavId {
  const match = [...CP_IMAGE_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => cpImageNavIsActive(pathname, item.href));
  return match?.id ?? 'home';
}
