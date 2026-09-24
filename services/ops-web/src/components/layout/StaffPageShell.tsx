'use client';

import type { ReactNode } from 'react';
import { OpsNav } from '@/components/OpsNav';
import { B2bHotAlarm } from '@/components/crm/B2bHotAlarm';
import { CsdChatDock } from '@/components/crm/csd/CsdChatDock';
import { CsdChatNotifyHost } from '@/components/crm/csd/CsdChatNotifyHost';
import { SlaAlertToastHost } from '@/components/crm/SlaAlertToastHost';
import type { StoredStaffUser } from '@/lib/auth';
import { OpsPage } from './OpsPage';
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
  return (
    <>
      {chatShell ? null : (
        <OpsNav
          user={user}
          onLogout={onLogout}
          agencyUnread={agencyUnread}
          emailPendingApprovals={emailPendingApprovals}
        />
      )}
      {chatShell ? null : <SlaAlertToastHost user={user} />}
      {chatShell ? null : <B2bHotAlarm user={user} />}
      <OpsPage breadcrumb={chatShell ? undefined : breadcrumb} width={chatShell ? 'full' : width}>
        {loading || !user ? <p className="muted">Đang tải…</p> : children}
      </OpsPage>
      {user ? <CsdChatNotifyHost user={user} /> : null}
      {user && !chatShell ? <CsdChatDock user={user} /> : null}
    </>
  );
}
