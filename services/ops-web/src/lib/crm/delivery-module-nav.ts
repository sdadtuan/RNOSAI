import { hasCap, type StoredStaffUser } from '@/lib/auth';

export type ModuleNavLink = {
  href: string;
  label: string;
};

export function buildCrmDeliveryModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!hasCap(user, 'crm_board', 'view')) return [];

  return [
    { href: '/crm/marketing-plan', label: 'Marketing plan' },
    { href: '/crm/service-delivery', label: 'Triển khai DV' },
    { href: '/crm/sop', label: 'SOP' },
    { href: '/crm/launch-qa', label: 'Launch QA' },
    { href: '/crm/creatives', label: 'Creative Hub' },
    { href: '/crm/campaign-writes', label: 'Campaign Write' },
  ];
}
