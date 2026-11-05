export const AM_HELP_LINKS = [
  { href: '/crm/account-management', label: 'Bàn làm việc' },
  { href: '/crm/account-management/clients', label: 'Sổ khách 360' },
  { href: '/crm/account-management/work', label: 'Hàng đợi việc' },
  { href: '/crm/account-management/renewals', label: 'Gia hạn' },
  { href: '/crm/account-management/health', label: 'Health & Risk' },
] as const;

export function amHelpTitle(): string {
  return 'Hướng dẫn Account Management';
}
