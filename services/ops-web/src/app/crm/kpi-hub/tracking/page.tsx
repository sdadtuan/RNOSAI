'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiActualDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiActualDrawer';
import { ServiceKpiActualImportDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiActualImportDrawer';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import { ServiceKpiTrackingPanel } from '@/components/kpi-hub/service-kpi/ServiceKpiTrackingPanel';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import { dictionaryLabelMap } from '@/lib/service-kpi-dictionary-labels';

export default function KpiHubTrackingPage() {
  const token = getAccessToken() ?? '';
  const canManage = hasCap(getStoredUser(), 'crm_kpi_dictionary', 'manage');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const params = useSearchParams();
  const highlightId = params.get('instance') ?? '';
  const { items, loading, error, refresh } = useServiceKpiInstances(token);
  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });
  const labels = useMemo(() => dictionaryLabelMap(dictionaryRows), [dictionaryRows]);

  const sortedItems = useMemo(() => {
    if (!highlightId) return items;
    return [...items].sort((a, b) => (a.id === highlightId ? -1 : b.id === highlightId ? 1 : 0));
  }, [items, highlightId]);

  const trackingTiles = useMemo(() => {
    const withActual = items.filter((i) => i.latest_actual != null).length;
    const tracking = items.filter((i) => i.status === 'TRACKING').length;
    const withoutActual = items.length - withActual;
    const assumptionOpen = items.filter(
      (i) => i.assumption_state === 'not_met' || i.assumption_state === 'pending',
    ).length;
    const atRisk = items.filter((i) => i.status === 'AT_RISK').length;
    const readinessWarn = items.filter(
      (i) => i.readiness_level === 'warning' || i.readiness_level === 'blocking',
    ).length;
    return [
      {
        label: 'Actual có dữ liệu',
        value: withActual,
        hint: items.length ? `${Math.round((withActual / items.length) * 100)}% instances` : '—',
        tone: 'ok' as const,
      },
      {
        label: 'API / connector',
        value: tracking,
        hint: 'Đang TRACKING',
      },
      {
        label: 'Manual / import',
        value: withoutActual,
        hint: assumptionOpen ? `${assumptionOpen} assumption mở` : 'Chưa có actual',
        tone: withoutActual ? ('warn' as const) : ('default' as const),
      },
      {
        label: 'Data issues',
        value: atRisk + readinessWarn,
        hint: `${atRisk} at-risk · ${readinessWarn} readiness`,
        tone: atRisk ? ('critical' as const) : readinessWarn ? ('warn' as const) : ('default' as const),
      },
    ];
  }, [items]);

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
              <>
                <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={() => setImportOpen(true)}>
                  ⇧ Import CSV
                </button>
                <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => setDrawerOpen(true)}>
                  + Nhập Actual
                </button>
              </>
            ) : null}
          </>
        }
        searchPlaceholder="Tìm instance, kỳ, source ref…"
      >
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiSummaryTiles tiles={trackingTiles} />
        <div style={{ marginTop: 16 }}>
          <ServiceKpiTrackingPanel instances={sortedItems} dictionaryLabels={labels} highlightId={highlightId} />
        </div>
      </KpiHubShell>
      <ServiceKpiActualDrawer
        open={drawerOpen}
        token={token}
        instances={sortedItems}
        dictionaryLabels={labels}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => refresh()}
      />
      <ServiceKpiActualImportDrawer
        open={importOpen}
        token={token}
        onClose={() => setImportOpen(false)}
        onImported={() => refresh()}
      />
    </KpiHubPageGate>
  );
}
