'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import { getAccessToken } from '@/lib/auth';
import { fetchServiceKpiOverview } from '@/lib/service-kpi-api';
import { OVERVIEW_TILE_LABELS, SKPI_SUBTITLES } from '@/lib/service-kpi-copy';
import type { ServiceKpiOverview } from '@/lib/service-kpi-types';

const EMPTY: ServiceKpiOverview = {
  templates_active: 0,
  instances_tracking: 0,
  instances_tracking_pct: 0,
  readiness_warning: 0,
  readiness_blocking: 0,
  at_risk: 0,
  at_risk_critical: 0,
};

export default function KpiHubServiceKpiOverviewPage() {
  const token = getAccessToken() ?? '';
  const [data, setData] = useState<ServiceKpiOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchServiceKpiOverview(token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi overview'))
      .finally(() => setLoading(false));
  }, [token]);

  const tiles = [
    {
      label: OVERVIEW_TILE_LABELS.templateActive,
      value: data.templates_active,
      hint: '21 DV + package ngành',
    },
    {
      label: OVERVIEW_TILE_LABELS.instanceTracking,
      value: data.instances_tracking.toLocaleString('vi-VN'),
      hint: `${data.instances_tracking_pct}% có measurement plan`,
      tone: data.instances_tracking_pct >= 90 ? ('ok' as const) : ('default' as const),
    },
    {
      label: OVERVIEW_TILE_LABELS.readinessWarning,
      value: data.readiness_warning,
      hint: `${data.readiness_blocking} blocking`,
      tone: data.readiness_blocking ? ('warn' as const) : ('default' as const),
    },
    {
      label: OVERVIEW_TILE_LABELS.kpiAtRisk,
      value: String(data.at_risk).padStart(2, '0'),
      hint: `${data.at_risk_critical} critical`,
      tone: data.at_risk ? ('critical' as const) : ('default' as const),
    },
  ];

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Service KPI — Tổng quan"
        subtitle={SKPI_SUBTITLES.overview}
        breadcrumb={[
          { label: 'KPI Hub' },
          { label: 'Service KPI', href: '/crm/kpi-hub/service-kpi' },
          { label: 'Tổng quan' },
        ]}
        actions={
          <Link href="/crm/kpi-hub/service-kpi" className="kpi-hub-btn kpi-hub-btn--ghost">
            War Room
          </Link>
        }
      >
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiSummaryTiles tiles={tiles} />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
