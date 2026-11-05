'use client';

import { Suspense } from 'react';
import { RevOpsTerritoryPage } from '@/components/crm/revops/RevOpsTerritoryPage';

export default function RevenueOpsTerritoryRoutePage() {
  return (
    <Suspense fallback={<p className="revops-muted">Đang tải…</p>}>
      <RevOpsTerritoryPage />
    </Suspense>
  );
}
