import { Suspense } from 'react';
import { CpImageBrand } from '@/components/crm/cp/CpImageBrand';

export default async function ImageSopBrandKitPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageBrand kitId={kitId} />
    </Suspense>
  );
}
