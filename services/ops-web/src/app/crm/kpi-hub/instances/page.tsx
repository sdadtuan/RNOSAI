'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiInstanceTable } from '@/components/kpi-hub/service-kpi/ServiceKpiInstanceTable';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { getAccessToken } from '@/lib/auth';

export default function KpiHubInstancesPage() {
  const token = getAccessToken() ?? '';
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const { items, loading, error, total } = useServiceKpiInstances(token, {
    status: status || undefined,
  });

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="KPI Instances"
        subtitle="KPI kế thừa/cấu hình theo Quote, Proposal, Project, Work Order hoặc Campaign"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'KPI Instances' }]}
        actions={
          <Link href="/crm/kpi-hub/service-templates" className="kpi-hub-btn kpi-hub-btn--ghost">
            Service KPI Template
          </Link>
        }
        searchPlaceholder="Tìm instance, quote, client…"
      >
        <div className="kpi-hub-skpi-summary">
          <span>{total} instances</span>
          {status ? <span>Filter: {status}</span> : null}
        </div>
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiInstanceTable rows={items} />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
