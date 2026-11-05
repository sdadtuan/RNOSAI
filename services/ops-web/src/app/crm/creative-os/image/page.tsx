import { Suspense } from 'react';
import { CpImageHome } from '@/components/crm/cp/CpImageHome';

export default function ImageSopHomePage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageHome />
    </Suspense>
  );
}
