'use client';

import { PortalPageShell } from '@/components/PortalPageShell';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default function DashboardPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Tổng quan' }]}>
      {({ token }) => <DashboardContent token={token} />}
    </PortalPageShell>
  );
}

