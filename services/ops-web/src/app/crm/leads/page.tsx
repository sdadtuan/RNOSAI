'use client';

import { Suspense } from 'react';
import { RevOpsEmbedFrame } from '@/components/crm/revops/RevOpsEmbedFrame';
import { CrmLeadsPageContent } from './CrmLeadsPageContent';

export default function CrmLeadsPage() {
  return (
    <Suspense fallback={<CrmLeadsPageContent flowScope="all" />}>
      <RevOpsEmbedFrame>
        <CrmLeadsPageContent flowScope="all" />
      </RevOpsEmbedFrame>
    </Suspense>
  );
}
