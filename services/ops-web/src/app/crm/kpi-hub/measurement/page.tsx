'use client';

import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiMeasurementPanel } from '@/components/kpi-hub/service-kpi/ServiceKpiMeasurementPanel';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { getAccessToken } from '@/lib/auth';

export default function KpiHubMeasurementPage() {
  const token = getAccessToken() ?? '';
  const { items, loading, error } = useServiceKpiInstances(token);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Measurement Plan"
        subtitle="Owner, cadence, mapping nguồn dữ liệu và SLA freshness cho từng KPI instance"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Measurement Plan' }]}
        searchPlaceholder="Tìm instance, mapping, owner…"
      >
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiMeasurementPanel instances={items} />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
