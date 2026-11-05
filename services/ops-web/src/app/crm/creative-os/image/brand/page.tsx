import { Suspense } from 'react';
import { CpImageBrand } from '@/components/crm/cp/CpImageBrand';

export default function ImageSopBrandPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageBrand />
    </Suspense>
  );
}
