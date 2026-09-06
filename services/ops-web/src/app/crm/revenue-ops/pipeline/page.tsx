'use client';

import { Suspense } from 'react';
import { RevOpsPipelinePage } from '@/components/crm/revops/RevOpsPipelinePage';

export default function RevenueOpsPipelineRoutePage() {
  return (
    <Suspense fallback={<p className="revops-muted">Đang tải…</p>}>
      <RevOpsPipelinePage />
    </Suspense>
  );
}
