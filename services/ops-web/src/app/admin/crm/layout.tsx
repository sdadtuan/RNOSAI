'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_GROUPS = [
  {
    label: 'Dữ liệu',
    links: [
      { href: '/admin/crm/custom-fields', label: 'Custom fields' },
      { href: '/admin/crm/pipeline', label: 'Pipeline sales' },
      { href: '/admin/crm/lead-lookups', label: 'Nguồn & Kênh' },
    ],
  },
  {
    label: 'Phân quyền',
    links: [
      { href: '/admin/crm/permissions', label: 'Chức vụ' },
      { href: '/admin/crm/permissions/functions', label: 'Job function' },
    ],
  },
] as const;

function isLinkActive(pathname: string, href: string): boolean {
  if (href === '/admin/crm/permissions') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminCrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <nav className="admin-crm-subnav admin-crm-subnav--grouped" aria-label="CRM admin">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="admin-crm-subnav__group">
            <span className="admin-crm-subnav__group-label">{group.label}</span>
            <div className="admin-crm-subnav__links">
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`admin-crm-subnav__link${
                    isLinkActive(pathname, link.href) ? ' admin-crm-subnav__link--active' : ''
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {children}
    </>
  );
}
