'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import { B2bHotAlarm } from '@/components/crm/B2bHotAlarm';
import { CsdChatDock } from '@/components/crm/csd/CsdChatDock';
import { CsdChatNotifyHost } from '@/components/crm/csd/CsdChatNotifyHost';
import { SlaAlertToastHost } from '@/components/crm/SlaAlertToastHost';
import type { StoredStaffUser } from '@/lib/auth';
import { showRsMobileChrome } from '@/lib/crm/rs-mobile-shell';
import { OpsPage } from './OpsPage';
import { RsMobileTabBar } from './RsMobileTabBar';
import { RsMobileTopBar } from './RsMobileTopBar';
import type { BreadcrumbItem } from './Breadcrumb';

type StaffPageShellProps = {
  user: StoredStaffUser | null;
  onLogout: () => void;
  breadcrumb?: BreadcrumbItem[];
  width?: 'default' | 'wide' | 'narrow' | 'full';
  agencyUnread?: number;
  emailPendingApprovals?: number;
  loading?: boolean;
  chrome?: 'crm' | 'chat';
  children: ReactNode;
};

export function StaffPageShell({
  user,
  onLogout,
  breadcrumb,
  width = 'wide',
  agencyUnread,
  emailPendingApprovals,
  loading,
  chrome = 'crm',
  children,
}: StaffPageShellProps) {
  const chatShell = chrome === 'chat';
  const pathname = usePathname();
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const read = () => {
      const next = showRsMobileChrome({
        width: query.matches ? 767 : 768,
        search: window.location.search,
      });
      setPhone(next);
      document.documentElement.classList.toggle('rs-mobile-chrome', next);
    };
    read();
    query.addEventListener('change', read);
    window.addEventListener('popstate', read);
    return () => {
      query.removeEventListener('change', read);
      window.removeEventListener('popstate', read);
      document.documentElement.classList.remove('rs-mobile-chrome');
    };
  }, [pathname]);

  const hideDesktop = phone || chatShell;

  return (
    <>
      {hideDesktop ? null : (
        <OpsNav
          user={user}
          onLogout={onLogout}
          agencyUnread={agencyUnread}
          emailPendingApprovals={emailPendingApprovals}
        />
      )}
      {hideDesktop ? null : <SlaAlertToastHost user={user} />}
      {hideDesktop ? null : <B2bHotAlarm user={user} />}
      {phone && !chatShell && user ? (
        <RsMobileTopBar
          user={user}
          pathname={pathname}
          onLogout={onLogout}
          agencyUnread={agencyUnread}
          emailPendingApprovals={emailPendingApprovals}
        />
      ) : null}
      <OpsPage breadcrumb={hideDesktop ? undefined : breadcrumb} width={chatShell ? 'full' : width}>
        {loading || (!user && !chatShell) ? <p className="muted">Đang tải…</p> : children}
      </OpsPage>
      {user ? <CsdChatNotifyHost user={user} /> : null}
      {user && !hideDesktop ? <CsdChatDock user={user} /> : null}
      {phone ? <RsMobileTabBar pathname={pathname} onLogout={onLogout} /> : null}
    </>
  );
}
