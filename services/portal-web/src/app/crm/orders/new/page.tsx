'use client';

import { useRouter } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosOrderForm } from '@/components/portal-pos/PortalPosOrderForm';

export default function NewOrderPage() {
  const router = useRouter();
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Đơn hàng', href: '/crm/orders' }, { label: 'Tạo đơn' }]}>
      {({ token }) => (
        <div className="pos" style={{ maxWidth: 720 }}>
          <h1>Tạo đơn hàng</h1>
          <PortalPosOrderForm token={token} confirmOnCreate={false} onCreated={(o) => router.push(`/crm/orders/${o.id}`)} />
        </div>
      )}
    </PortalPageShell>
  );
}
