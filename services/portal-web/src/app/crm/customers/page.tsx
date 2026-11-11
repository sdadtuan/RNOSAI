'use client';

import { useSearchParams } from 'next/navigation';
import { CrmScreen, type CustomerSourceFilter } from '@/components/portal-crm/CrmScreen';

export default function PortalCustomersPage() {
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  const initialSource: CustomerSourceFilter | undefined =
    source === 'lead' || source === 'message' ? source : undefined;
  return <CrmScreen view="customers" initialCustomerSource={initialSource} />;
}
