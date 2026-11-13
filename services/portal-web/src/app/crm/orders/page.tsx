'use client';

import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosOrders } from '@/components/portal-pos/PortalPosOrders';

export default function OrdersPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Đơn hàng' }]}>
      {({ token }) => <PortalPosOrders token={token} />}
    </PortalPageShell>
  );
}
