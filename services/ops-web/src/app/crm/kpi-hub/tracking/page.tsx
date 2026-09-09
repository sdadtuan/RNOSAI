'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiActualDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiActualDrawer';
import { ServiceKpiTrackingPanel } from '@/components/kpi-hub/service-kpi/ServiceKpiTrackingPanel';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import { dictionaryLabelMap } from '@/lib/service-kpi-dictionary-labels';

export default function KpiHubTrackingPage() {
  const token = getAccessToken() ?? '';
  const canManage = hasCap(getStoredUser(), 'crm_kpi_dictionary', 'manage');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const params = useSearchParams();
  const highlightId = params.get('instance') ?? '';
  const { items, loading, error, refresh } = useServiceKpiInstances(token);
  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });
  const labels = useMemo(() => dictionaryLabelMap(dictionaryRows), [dictionaryRows]);

  const sortedItems = useMemo(() => {
    if (!highlightId) return items;
    return [...items].sort((a, b) => (a.id === highlightId ? -1 : b.id === highlightId ? 1 : 0));
  }, [items, highlightId]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Actual Tracking"
        subtitle="Theo dõi actual theo kỳ, variance và chất lượng dữ liệu"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Actual Tracking' }]}
        actions={
          <>
            <Link href="/crm/kpi-hub/measurement" className="kpi-hub-btn kpi-hub-btn--ghost">
              Measurement Plan
            </Link>
            {canManage ? (
              <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => setDrawerOpen(true)}>
                + Nhập Actual
              </button>
            ) : null}
          </>
        }
        searchPlaceholder="Tìm instance, kỳ, source ref…"
      >
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiTrackingPanel instances={sortedItems} dictionaryLabels={labels} highlightId={highlightId} />
      </KpiHubShell>
      <ServiceKpiActualDrawer
        open={drawerOpen}
        token={token}
        instances={sortedItems}
        dictionaryLabels={labels}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => refresh()}
      />
    </KpiHubPageGate>
  );
}
