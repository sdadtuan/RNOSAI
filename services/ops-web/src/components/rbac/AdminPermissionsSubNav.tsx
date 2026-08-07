import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/crm/permissions', label: 'Chức vụ' },
  { href: '/admin/crm/permissions/functions', label: 'Job function' },
];

export function AdminPermissionsSubNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-permissions-subnav" aria-label="Phân quyền CRM">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`admin-permissions-subnav__link${
            pathname === link.href ? ' admin-permissions-subnav__link--active' : ''
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
