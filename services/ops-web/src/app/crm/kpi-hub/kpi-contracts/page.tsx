'use client';

import Link from 'next/link';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiContractCard } from '@/components/kpi-hub/service-kpi/ServiceKpiContractCard';

export default function KpiHubContractsPage() {
  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="KPI Contract & Risk"
        subtitle="Điểm rủi ro hợp đồng KPI — duyệt cùng GM floor. Internal only."
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'KPI Contract & Risk' }]}
        actions={
          <Link href="/crm/kpi-hub/service-kpi" className="kpi-hub-btn kpi-hub-btn--ghost">
            War Room
          </Link>
        }
        searchPlaceholder="Tìm quote, score, waiver…"
      >
        <ServiceKpiContractCard />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
