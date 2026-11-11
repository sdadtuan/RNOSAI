'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalCustomerLeadsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/crm/customers?source=lead');
  }, [router]);
  return null;
}
