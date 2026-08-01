'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  badge?: number;
  match: (path: string) => boolean;
}

interface Props {
  pendingCreatives?: number;
  notificationUnread?: number;
  emailPending?: number;
  emailEnabled?: boolean;
  isApprover?: boolean;
}

function badge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function PortalMobileBottomNav({
  pendingCreatives = 0,
  notificationUnread = 0,
  emailPending = 0,
  emailEnabled = false,
  isApprover = false,
}: Props) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Home', match: (p) => p === '/dashboard' || p === '/' },
    {
      href: '/creatives',
      label: 'Creative',
      badge: pendingCreatives,
      match: (p) => p.startsWith('/creatives'),
    },
    {
      href: '/notifications',
      label: 'Alerts',
      badge: notificationUnread,
      match: (p) => p.startsWith('/notifications'),
    },
  ];

  if (emailEnabled && isApprover) {
    items.push({
      href: '/email/approvals',
      label: 'Email',
      badge: emailPending,
      match: (p) => p.startsWith('/email/approvals'),
    });
  }

  items.push({
    href: '/settings',
    label: 'Settings',
    match: (p) => p.startsWith('/settings'),
  });

  return (
    <nav className="portal-mobile-bottom-nav" aria-label="Điều hướng mobile">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`portal-mobile-bottom-nav__item${active ? ' portal-mobile-bottom-nav__item--active' : ''}`}
          >
            <span className="portal-mobile-bottom-nav__label">{item.label}</span>
            {'badge' in item && typeof item.badge === 'number' && item.badge > 0 ? (
              <span className="portal-mobile-bottom-nav__badge">{badge(item.badge)}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
