import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/crm/permissions', label: 'Chức vụ', exact: true },
  { href: '/admin/crm/permissions/functions', label: 'Job function' },
  { href: '/admin/crm/permissions/users', label: 'Gán user' },
];

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
            isActive(pathname, link.href, link.exact) ? ' admin-permissions-subnav__link--active' : ''
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
