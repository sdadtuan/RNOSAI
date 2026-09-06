'use client';

import { Suspense } from 'react';
import { RevOpsReportsPage } from '@/components/crm/revops/RevOpsReportsPage';

export default function RevenueOpsReportsRoutePage() {
  return (
    <Suspense fallback={<p className="revops-muted">Đang tải…</p>}>
      <RevOpsReportsPage />
    </Suspense>
  );
}
