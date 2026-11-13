'use client';

import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { PortalPageShell } from '@/components/PortalPageShell';

export default function PortalCrmPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Tổng quan' }]}>
      {({ token }) => <DashboardContent token={token} />}
    </PortalPageShell>
  );
}
