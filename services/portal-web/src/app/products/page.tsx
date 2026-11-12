'use client';

import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosProducts } from '@/components/portal-pos/PortalPosProducts';

export default function ProductsPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Client Portal', href: '/crm' }, { label: 'Sản phẩm' }]}>
      {({ token, user }) => <PortalPosProducts token={token} canManage={user.role !== 'staff'} />}
    </PortalPageShell>
  );
}
