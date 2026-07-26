'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/crm/custom-fields', label: 'Custom fields' },
  { href: '/admin/crm/pipeline', label: 'Pipeline sales' },
];

export default function AdminCrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <nav className="admin-crm-subnav" aria-label="CRM admin">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`admin-crm-subnav__link${pathname === link.href ? ' admin-crm-subnav__link--active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
