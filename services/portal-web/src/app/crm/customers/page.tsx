'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CrmScreen, type CustomerSourceFilter } from '@/components/portal-crm/CrmScreen';

function PortalCustomersContent() {
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const initialSource: CustomerSourceFilter | undefined =
    source === 'lead' || source === 'message' ? source : undefined;
  return <CrmScreen view="customers" initialCustomerSource={initialSource} />;
}

export default function PortalCustomersPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải khách hàng…</p>}>
      <PortalCustomersContent />
    </Suspense>
  );
}
