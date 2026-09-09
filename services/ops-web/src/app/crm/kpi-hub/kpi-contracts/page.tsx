'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiContractCard } from '@/components/kpi-hub/service-kpi/ServiceKpiContractCard';
import { getAccessToken } from '@/lib/auth';
import {
  fetchServiceKpiContractQuotes,
  fetchServiceKpiContractRisk,
  fetchServiceKpiContractScoreLive,
} from '@/lib/service-kpi-api';
import type {
  ServiceKpiContractRiskItem,
  ServiceKpiContractScoreLive,
  ServiceKpiQuoteContractScore,
} from '@/lib/service-kpi-types';

export default function KpiHubContractsPage() {
  const token = getAccessToken() ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const versionParam = searchParams.get('version') ?? '';

  const [quotes, setQuotes] = useState<ServiceKpiQuoteContractScore[]>([]);
  const [riskItems, setRiskItems] = useState<ServiceKpiContractRiskItem[]>([]);
  const [liveScore, setLiveScore] = useState<ServiceKpiContractScoreLive | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setQuotes([]);
      setRiskItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void Promise.all([fetchServiceKpiContractQuotes(token), fetchServiceKpiContractRisk(token)])
      .then(([quoteRes, riskRes]) => {
        setQuotes(quoteRes.items);
        if ('items' in riskRes) setRiskItems(riskRes.items);
        else setRiskItems([]);
        const initial =
          versionParam && quoteRes.items.some((q) => q.version_id === versionParam)
            ? versionParam
            : (quoteRes.items[0]?.version_id ?? '');
        setSelectedVersionId(initial);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi contract risk'))
      .finally(() => setLoading(false));
  }, [token, versionParam]);

  useEffect(() => {
    if (!token || !selectedVersionId) {
      setLiveScore(null);
      return;
    }
    const quote = quotes.find((q) => q.version_id === selectedVersionId);
    setScoreLoading(true);
    void fetchServiceKpiContractScoreLive(token, selectedVersionId, quote?.gm_bps ?? null)
      .then(setLiveScore)
      .catch(() => setLiveScore(null))
      .finally(() => setScoreLoading(false));
  }, [token, selectedVersionId, quotes]);

  const handleSelectVersion = useCallback(
    (versionId: string) => {
      setSelectedVersionId(versionId);
      const quote = quotes.find((q) => q.version_id === versionId);
      const params = new URLSearchParams();
      params.set('version', versionId);
      if (quote?.proposal_id) params.set('proposal', String(quote.proposal_id));
      router.replace(`/crm/kpi-hub/kpi-contracts?${params.toString()}`);
    },
    [quotes, router],
  );

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="KPI Contract & Risk"
        subtitle="Điểm rủi ro hợp đồng KPI — duyệt cùng GM floor. Internal only."
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'KPI Contract & Risk' }]}
        actions={
          <Link href="/crm/kpi-hub/service-kpi" className="kpi-hub-btn kpi-hub-btn--ghost">
            War Room
          </Link>
        }
        searchPlaceholder="Tìm quote, score, waiver…"
      >
        <ServiceKpiContractCard
          quotes={quotes}
          selectedVersionId={selectedVersionId}
          onSelectVersion={handleSelectVersion}
          liveScore={liveScore}
          riskItems={riskItems}
          loading={loading}
          scoreLoading={scoreLoading}
          error={error}
        />
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
