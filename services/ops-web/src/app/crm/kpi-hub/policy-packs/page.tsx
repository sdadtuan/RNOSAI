'use client';

import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiPolicyPackView } from '@/components/kpi-hub/service-kpi/ServiceKpiPolicyPackView';
import { getAccessToken } from '@/lib/auth';
import { fetchServiceKpiPolicyPacks } from '@/lib/service-kpi-api';
import { SKPI_SUBTITLES } from '@/lib/service-kpi-copy';
import type { ServiceKpiPolicyPack } from '@/lib/service-kpi-types';

export default function KpiHubPolicyPacksPage() {
  const token = getAccessToken() ?? '';
  const [packs, setPacks] = useState<ServiceKpiPolicyPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPacks([
        {
          id: 'demo',
          industry: 'real_estate',
          regulated: true,
          rules_json: [],
          banned_phrases: ['cam kết doanh số', 'đảm bảo lead', 'chắc chắn X lead'],
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchServiceKpiPolicyPacks(token)
      .then(setPacks)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi tải pack'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Industry Policy Pack"
        subtitle={SKPI_SUBTITLES.packs}
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Policy Pack' }]}
        searchPlaceholder="Tìm pack, ngành, từ cấm…"
      >
        <ServiceKpiPolicyPackView packs={packs} loading={loading} error={error} />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
