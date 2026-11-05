'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiMeasurementPlanForm } from '@/components/kpi-hub/service-kpi/ServiceKpiMeasurementPlanForm';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { getAccessToken } from '@/lib/auth';
import { dictionaryLabelMap } from '@/lib/service-kpi-dictionary-labels';
import { SKPI_SUBTITLES } from '@/lib/service-kpi-copy';

export default function KpiHubMeasurementPage() {
  const token = getAccessToken() ?? '';
  const params = useSearchParams();
  const instanceParam = params.get('instance') ?? '';
  const { items, loading, error } = useServiceKpiInstances(token);
  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });
  const labels = useMemo(() => dictionaryLabelMap(dictionaryRows), [dictionaryRows]);

  const sortedItems = useMemo(() => {
    if (!instanceParam) return items;
    return [...items].sort((a, b) => (a.id === instanceParam ? -1 : b.id === instanceParam ? 1 : 0));
  }, [items, instanceParam]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Measurement Plan"
        subtitle={SKPI_SUBTITLES.measurement}
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Measurement Plan' }]}
        actions={
          <Link href="/crm/kpi-hub/instances" className="kpi-hub-btn kpi-hub-btn--ghost">
            KPI Instances
          </Link>
        }
        searchPlaceholder="Tìm instance, mapping, owner…"
      >
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiMeasurementPlanForm
          token={token}
          instances={sortedItems}
          dictionaryLabels={labels}
          dictionaryRows={dictionaryRows}
        />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
