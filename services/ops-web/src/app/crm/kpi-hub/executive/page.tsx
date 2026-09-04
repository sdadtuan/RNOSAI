'use client';

import { useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { CcApprovalQueue } from '@/components/kpi-hub/command-center/CcApprovalQueue';
import { CcAtRisk } from '@/components/kpi-hub/command-center/CcAtRisk';
import { CcDataTrust } from '@/components/kpi-hub/command-center/CcDataTrust';
import { CcExceptions } from '@/components/kpi-hub/command-center/CcExceptions';
import { CcForecastChart } from '@/components/kpi-hub/command-center/CcForecastChart';
import { CcFunnel } from '@/components/kpi-hub/command-center/CcFunnel';
import { CcKpiTiles } from '@/components/kpi-hub/command-center/CcKpiTiles';
import { CcPageToolbar } from '@/components/kpi-hub/command-center/CcPageToolbar';
import { useKpiHubCommandCenter } from '@/hooks/useKpiHubCommandCenter';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';

export default function ExecutiveCommandCenterPage() {
  const token = getAccessToken() ?? '';
  const user = getStoredUser();
  const [compare, setCompare] = useState(true);
  const query = useMemo(() => ({ compare }), [compare]);
  const { data, loading, error } = useKpiHubCommandCenter(token, 'executive', query);

  const chips = useMemo(() => {
    const list = [
      { label: 'Client: PTT' },
      { label: 'Business Unit: Tất cả' },
    ];
    if (user && hasCap(user, 'crm_kpi_hub', 'view')) {
      list.push({ label: 'RLS' });
    }
    if (data.period.from && data.period.to) {
      list.push({ label: `${data.period.from} → ${data.period.to}` });
    }
    return list;
  }, [data.period.from, data.period.to, user]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Executive Command Center"
        subtitle="Hiệu suất kinh doanh theo thời gian thực và độ tin cậy dữ liệu."
        showFreshness
      >
        <div className="cc-page">
          <CcPageToolbar compare={compare} onCompareChange={setCompare} chips={chips} />
          {error ? <p className="error">{error}</p> : null}
          <CcKpiTiles tiles={data.tiles} loading={loading} testIdPrefix="exec" />
          <div className="cc-row cc-row--2">
            <CcForecastChart series={data.series} testId="exec-forecast" />
            <CcAtRisk items={data.at_risk} testId="exec-at-risk" />
          </div>
          <div className="cc-row cc-row--3">
            <CcFunnel funnel={data.funnel} testId="exec-funnel" />
            <CcDataTrust trust={data.trust} testId="exec-trust" />
            <CcApprovalQueue approvals={data.approvals} testId="exec-approvals" />
          </div>
          <CcExceptions exceptions={data.exceptions} testId="exec-exceptions" />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
