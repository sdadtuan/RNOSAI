'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalPosCustomers } from '@/components/portal-pos/PortalPosCustomers';

function CustomersInner() {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || searchParams.get('pos') || '';

  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: 'Khách hàng' }]}>
      {({ token, user }) => (
        <PortalPosCustomers token={token} canManage={user.role === 'approver'} initialPhone={phone} userId={user.id} />
      )}
    </PortalPageShell>
  );
}

export default function PortalCustomersPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải khách hàng…</p>}>
      <CustomersInner />
    </Suspense>
  );
}