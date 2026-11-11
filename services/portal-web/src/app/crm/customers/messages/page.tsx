'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalCustomerMessagesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/crm/customers?source=message');
  }, [router]);
  return null;
}
