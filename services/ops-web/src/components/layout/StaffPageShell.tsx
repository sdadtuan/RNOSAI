'use client';

import type { ReactNode } from 'react';
import { OpsNav } from '@/components/OpsNav';
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
  children,
}: StaffPageShellProps) {
  return (
    <>
      <OpsNav
        user={user}
        onLogout={onLogout}
        agencyUnread={agencyUnread}
        emailPendingApprovals={emailPendingApprovals}
      />
      <OpsPage breadcrumb={breadcrumb} width={width}>
        {loading || !user ? <p className="muted">Đang tải…</p> : children}
      </OpsPage>
    </>
  );
}
