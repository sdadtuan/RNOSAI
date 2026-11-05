import { Suspense } from 'react';
import { CpImageReview } from '@/components/crm/cp/CpImageReview';

export default async function ImageSopReviewAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageReview assetId={assetId} />
    </Suspense>
  );
}
