'use client';

import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosProducts } from '@/components/portal-pos/PortalPosProducts';

export default function ProductsPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Sản phẩm' }]}>
      {({ token, user }) => <PortalPosProducts token={token} canManage={user.role !== 'staff'} />}
    </PortalPageShell>
  );
}
