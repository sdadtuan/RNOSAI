'use client';

import { Suspense } from 'react';
import { RevOpsEmbedFrame } from '@/components/crm/revops/RevOpsEmbedFrame';
import { SalesCommissionPanel } from '@/components/kpi-hub/command-center/SalesCommissionPanel';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { getAccessToken } from '@/lib/auth';

export default function KpiHubCommissionPage() {
  const token = getAccessToken() ?? '';

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <Suspense fallback={null}>
        <RevOpsEmbedFrame>
          <KpiHubShell
            title="Commission & Payout"
            subtitle="Trọng số KPI, projection, nhân sự và payout batch từ RevOps W3."
            showFreshness
          >
            <div className="cc-page">
              <SalesCommissionPanel token={token} />
            </div>
          </KpiHubShell>
        </RevOpsEmbedFrame>
      </Suspense>
    </KpiHubPageGate>
  );
}
