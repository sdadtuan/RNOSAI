'use client';

import { Suspense } from 'react';
import { RevOpsCommandCenter } from '@/components/crm/revops/RevOpsCommandCenter';

export default function RevenueOpsCommandCenterPage() {
  return (
    <Suspense fallback={<p className="revops-muted">Đang tải…</p>}>
      <RevOpsCommandCenter />
    </Suspense>
  );
}
