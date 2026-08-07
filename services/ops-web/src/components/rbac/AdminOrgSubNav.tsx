'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/crm/org/departments', label: 'Phòng ban' },
  { href: '/admin/crm/org/teams', label: 'Team' },
  { href: '/admin/crm/org/positions', label: 'Chức vụ' },
  { href: '/admin/crm/org/users', label: 'Nhân viên' },
  { href: '/admin/crm/org/chart', label: 'Sơ đồ' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminOrgSubNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-crm-subnav admin-org-subnav" aria-label="Tổ chức">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`admin-crm-subnav__link${
            isActive(pathname, link.href) ? ' admin-crm-subnav__link--active' : ''
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
