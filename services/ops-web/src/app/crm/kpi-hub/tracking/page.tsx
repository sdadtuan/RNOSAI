'use client';

import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiTrackingPanel } from '@/components/kpi-hub/service-kpi/ServiceKpiTrackingPanel';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { getAccessToken } from '@/lib/auth';

export default function KpiHubTrackingPage() {
  const token = getAccessToken() ?? '';
  const { items, loading, error } = useServiceKpiInstances(token);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Actual Tracking"
        subtitle="Theo dõi actual theo kỳ, variance và chất lượng dữ liệu"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Actual Tracking' }]}
        searchPlaceholder="Tìm instance, kỳ, source ref…"
      >
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiTrackingPanel instances={items} />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
