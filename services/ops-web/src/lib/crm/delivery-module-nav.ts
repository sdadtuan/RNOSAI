import { canViewContentOs, hasCap, type StoredStaffUser } from '@/lib/auth';
import { shouldShowMediaOsNav } from '@/components/ops-nav-media-os';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';

export type ModuleNavLink = {
  href: string;
  label: string;
};

export function buildCrmDeliveryModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!hasCap(user, 'crm_board', 'view')) return [];

  const links: ModuleNavLink[] = [
    { href: '/crm/marketing-plan', label: 'Marketing plan' },
    { href: '/crm/service-delivery', label: 'Triển khai DV' },
    { href: '/crm/sop', label: 'SOP' },
    { href: '/crm/launch-qa', label: 'Launch QA' },
    { href: '/crm/creatives', label: 'Creative Hub' },
    { href: '/crm/campaign-writes', label: 'Campaign Write' },
  ];
  if (isContentMarketingFeEnabled() && canViewContentOs(user)) {
    links.push({ href: '/crm/content-os', label: 'Content Marketing OS' });
  }
  if (shouldShowMediaOsNav(user)) {
    links.push({ href: '/crm/media-os', label: 'Media OS' });
  }
  if (isOpsDvFeEnabled()) {
    links.push(
      { href: '/crm/ops/dashboard', label: 'Ops Dashboard' },
      { href: '/crm/ops/my-tasks', label: 'Ops tasks' },
      { href: '/crm/ops/alerts', label: 'Ops alerts' },
    );
  }
  return links;
}
