'use client';

import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosSalesReport } from '@/components/portal-pos/PortalPosSalesReport';

export default function SalesPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Báo cáo bán hàng' }]}>
      {({ token, user }) => <PortalPosSalesReport token={token} canManage={user.role !== 'staff'} />}
    </PortalPageShell>
  );
}
