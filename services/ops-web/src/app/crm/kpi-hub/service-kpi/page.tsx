'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiWarRoom } from '@/components/kpi-hub/service-kpi/ServiceKpiWarRoom';
import { getAccessToken } from '@/lib/auth';
import { fetchServiceKpiWarRoom } from '@/lib/service-kpi-api';
import { SKPI_SUBTITLES } from '@/lib/service-kpi-copy';
import type { ServiceKpiWarRoomData } from '@/lib/service-kpi-types';

const EMPTY: ServiceKpiWarRoomData = {
  critical_overdue: 0,
  assumptions_open: 0,
  blocked_reports: 0,
  quotes_score_gte_70: 0,
  queue: [],
  dv_health: [],
};

export default function KpiHubServiceKpiWarRoomPage() {
  const token = getAccessToken() ?? '';
  const [data, setData] = useState<ServiceKpiWarRoomData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchServiceKpiWarRoom(token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi War Room'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Service KPI War Room"
        subtitle={SKPI_SUBTITLES.warroom}
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'War Room' }]}
        actions={
          <>
            <Link href="/crm/kpi-hub/kpi-contracts" className="kpi-hub-btn kpi-hub-btn--ghost">
              Contract Score
            </Link>
            <Link href="/crm/kpi-hub/reconcile" className="kpi-hub-btn kpi-hub-btn--primary">
              Đối soát 3 sổ
            </Link>
          </>
        }
        searchPlaceholder="Tìm quote, client, DV at-risk…"
      >
        <ServiceKpiWarRoom data={data} loading={loading} error={error} />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
