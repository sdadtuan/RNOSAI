'use client';

import { useParams } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosOrderDetail } from '@/components/portal-pos/PortalPosOrderDetail';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Đơn hàng', href: '/crm/orders' }, { label: 'Chi tiết' }]}>
      {({ token, user }) => <PortalPosOrderDetail token={token} id={String(params.id)} canManage={user.role !== 'staff'} />}
    </PortalPageShell>
  );
}
