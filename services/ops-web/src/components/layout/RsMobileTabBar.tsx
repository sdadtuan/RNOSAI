'use client';

import Link from 'next/link';
import { RS_MOBILE_TABS, rsMobileTabId } from '@/lib/crm/rs-mobile-shell';

type RsMobileTabBarProps = {
  pathname: string;
  onLogout: () => void;
};

export function RsMobileTabBar({ pathname, onLogout }: RsMobileTabBarProps) {
  const active = rsMobileTabId(pathname);
  return (
    <nav className="rs-mobile-tabbar" aria-label="PTT CRM">
      <div className="rs-mobile-tabbar__tabs">
        {RS_MOBILE_TABS.map((tab) => (
          <Link key={tab.id} href={tab.href} aria-current={active === tab.id ? 'page' : undefined}>
            {tab.label}
          </Link>
        ))}
      </div>
      <button type="button" className="rs-mobile-tabbar__logout" onClick={onLogout}>
        Đăng xuất
      </button>
    </nav>
  );
}
