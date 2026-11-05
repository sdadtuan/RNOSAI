'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { REVOPS_MOBILE_NAV, activeRevopsHref } from '@/lib/crm/revops-nav.util';

const NAV_ICONS: Record<string, string> = {
  command: '◉',
  leads: '◎',
  pipeline: '▥',
  accounts: '◌',
  handover: '⇄',
  renewal: '↻',
  kpi: '◈',
  sla: '◷',
  reports: '▤',
  territory: '⌖',
  approvals: '✓',
  settings: '⚙',
};

export function RevOpsMobileNav() {
  const pathname = usePathname() ?? '';
  const activeHref = activeRevopsHref(pathname);

  return (
    <nav className="revops-mobile-nav" aria-label="Revenue Operations mobile">
      {REVOPS_MOBILE_NAV.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={active ? 'is-active' : undefined}
            aria-current={active ? 'page' : undefined}
            data-testid={`revops-mobile-nav-${item.id}`}
          >
            <span aria-hidden>{NAV_ICONS[item.icon] ?? '•'}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
