'use client';

import { DashboardContent } from '@/app/dashboard/page';
import { PortalPageShell } from '@/components/PortalPageShell';

export default function PortalCrmPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Client Portal', href: '/crm' }, { label: 'Tổng quan' }]}>
      {({ token }) => <DashboardContent token={token} />}
    </PortalPageShell>
  );
}
