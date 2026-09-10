'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CmktEWorkspace } from '@/components/content-os/cmkte/CmktEWorkspace';
import { parseCmktETab } from '@/lib/crm/cmkte-tabs';

export default function CrmContentOsWorkspacePage() {
  return (
    <Suspense fallback={<p className="cmkte-status">Đang tải…</p>}>
      <CrmContentOsWorkspaceContent />
    </Suspense>
  );
}

function CrmContentOsWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = Number(params?.itemId ?? 0);
  const itemId = Number.isInteger(rawId) && rawId > 0 ? rawId : 0;
  const hint = Number(searchParams.get('lifecycle') ?? '');
  const lifecycleHint = Number.isInteger(hint) && hint > 0 ? hint : undefined;
  const initialTab = parseCmktETab(searchParams.get('tab'));
  return <CmktEWorkspace itemId={itemId} lifecycleHint={lifecycleHint} initialTab={initialTab} />;
}
