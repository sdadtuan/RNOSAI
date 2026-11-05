'use client';

import { Suspense } from 'react';
import { RevOpsSlaPage } from '@/components/crm/revops/RevOpsSlaPage';

export default function RevenueOpsSlaRoutePage() {
  return (
    <Suspense fallback={<p className="revops-muted">Đang tải…</p>}>
      <RevOpsSlaPage />
    </Suspense>
  );
}
