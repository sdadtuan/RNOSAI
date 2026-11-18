'use client';

import { Suspense } from 'react';
import { PortalInbox } from '@/components/portal-crm/PortalInbox';

export default function PortalCrmMessagesPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải tin nhắn…</p>}>
      <PortalInbox />
    </Suspense>
  );
}
