'use client';

import { Suspense } from 'react';
import { RevOpsSettingsPage } from '@/components/crm/revops/RevOpsSettingsPage';

export default function RevenueOpsSettingsRoutePage() {
  return (
    <Suspense fallback={<p className="revops-muted">Đang tải…</p>}>
      <RevOpsSettingsPage />
    </Suspense>
  );
}
