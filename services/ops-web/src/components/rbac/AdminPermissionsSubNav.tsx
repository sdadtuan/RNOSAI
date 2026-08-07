import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { winPermissionSetsEnabled, winSimulatorEnabled, winSsoEnabled } from '@/lib/win/flags';

const LINKS = [
  { href: '/admin/crm/permissions', label: 'Chức vụ', exact: true },
  { href: '/admin/crm/permissions/functions', label: 'Job function' },
  { href: '/admin/crm/permissions/users', label: 'Gán user' },
  ...(winSimulatorEnabled()
    ? [{ href: '/admin/crm/permissions/simulator', label: 'Simulator' }]
    : []),
  ...(winPermissionSetsEnabled()
    ? [{ href: '/admin/crm/permission-sets', label: 'Permission Sets' }]
    : []),
  ...(winSsoEnabled() ? [{ href: '/admin/crm/sso/groups', label: 'SSO groups' }] : []),
] as const;

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminPermissionsSubNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-permissions-subnav" aria-label="Phân quyền CRM">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`admin-permissions-subnav__link${
            isActive(pathname, link.href, 'exact' in link ? link.exact : undefined)
              ? ' admin-permissions-subnav__link--active'
              : ''
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
