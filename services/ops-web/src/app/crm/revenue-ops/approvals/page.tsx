'use client';

import { Suspense } from 'react';
import { RevOpsApprovalsPage } from '@/components/crm/revops/RevOpsApprovalsPage';

export default function RevenueOpsApprovalsRoutePage() {
  return (
    <Suspense fallback={<p className="revops-muted">Đang tải…</p>}>
      <RevOpsApprovalsPage />
    </Suspense>
  );
}
