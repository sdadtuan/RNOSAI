'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiActualDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiActualDrawer';
import { ServiceKpiActualImportDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiActualImportDrawer';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import {
  ServiceKpiTrackingPanel,
  trackingSummaryTiles,
} from '@/components/kpi-hub/service-kpi/ServiceKpiTrackingPanel';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { useServiceKpiTracking } from '@/hooks/useServiceKpiTracking';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import { dictionaryLabelMap } from '@/lib/service-kpi-dictionary-labels';
import { SKPI_SUBTITLES } from '@/lib/service-kpi-copy';

export default function KpiHubTrackingPage() {
  const token = getAccessToken() ?? '';
  const canManage = hasCap(getStoredUser(), 'crm_kpi_dictionary', 'manage');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const params = useSearchParams();
  const highlightFromUrl = params.get('instance') ?? '';
  const { items, loading: instancesLoading, error: instancesError, refresh: refreshInstances } =
    useServiceKpiInstances(token);
  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });
  const labels = useMemo(() => dictionaryLabelMap(dictionaryRows), [dictionaryRows]);

  const effectiveHighlightId = useMemo(() => {
    if (highlightFromUrl) return highlightFromUrl;
    const atRisk = items.find((i) => i.status === 'AT_RISK');
    if (atRisk) return atRisk.id;
    const withActual = items.find((i) => i.latest_actual != null);
    if (withActual) return withActual.id;
    return items[0]?.id ?? '';
  }, [highlightFromUrl, items]);

  const {
    summary,
    recent,
    highlight,
    loading: trackingLoading,
    error: trackingError,
    refresh: refreshTracking,
  } = useServiceKpiTracking(token, effectiveHighlightId || undefined);

  const trackingTiles = useMemo(() => trackingSummaryTiles(summary), [summary]);

  const sortedItems = useMemo(() => {
    if (!effectiveHighlightId) return items;
    return [...items].sort((a, b) =>
      a.id === effectiveHighlightId ? -1 : b.id === effectiveHighlightId ? 1 : 0,
    );
  }, [items, effectiveHighlightId]);

  const handleSaved = () => {
    refreshInstances();
    refreshTracking();
  };

  const loading = instancesLoading || trackingLoading;
  const error = instancesError ?? trackingError;

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Actual Tracking"
        subtitle={SKPI_SUBTITLES.tracking}
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
          <ServiceKpiTrackingPanel
            summary={summary}
            recent={recent}
            highlight={highlight}
            dictionaryLabels={labels}
            loading={trackingLoading}
          />
        </div>
      </KpiHubShell>
      <ServiceKpiActualDrawer
        open={drawerOpen}
        token={token}
        instances={sortedItems}
        dictionaryLabels={labels}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />
      <ServiceKpiActualImportDrawer
        open={importOpen}
        token={token}
        onClose={() => setImportOpen(false)}
        onImported={handleSaved}
      />
    </KpiHubPageGate>
  );
}
