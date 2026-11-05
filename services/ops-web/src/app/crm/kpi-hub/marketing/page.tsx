'use client';

import { useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { CcAtRisk } from '@/components/kpi-hub/command-center/CcAtRisk';
import { CcDataTrust } from '@/components/kpi-hub/command-center/CcDataTrust';
import { CcFunnel } from '@/components/kpi-hub/command-center/CcFunnel';
import { CcKpiTiles } from '@/components/kpi-hub/command-center/CcKpiTiles';
import { CcPageToolbar } from '@/components/kpi-hub/command-center/CcPageToolbar';
import { MktCampaignTable } from '@/components/kpi-hub/command-center/MktCampaignTable';
import { MktChannelDonut } from '@/components/kpi-hub/command-center/MktChannelDonut';
import { MktCreatives } from '@/components/kpi-hub/command-center/MktCreatives';
import { MktMediaChart } from '@/components/kpi-hub/command-center/MktMediaChart';
import { useKpiHubCommandCenter } from '@/hooks/useKpiHubCommandCenter';
import { getAccessToken } from '@/lib/auth';

const DEFAULT_MARKETING = {
  spend_series: [],
  channels: [],
  campaigns: [],
  creatives: [],
  insight: null as string | null,
  grain: { adset: false, creative: false, landing: false },
};

export default function MarketingCommandCenterPage() {
  const token = getAccessToken() ?? '';
  const [compare, setCompare] = useState(true);
  const query = useMemo(() => ({ compare }), [compare]);
  const { data, loading, error } = useKpiHubCommandCenter(token, 'marketing', query);
  const marketing = data.marketing ?? DEFAULT_MARKETING;

  const chips = [
    { label: 'Toàn bộ kênh' },
    { label: 'Tất cả campaign' },
    { label: 'Sản phẩm: Tất cả' },
    { label: 'Khu vực: Tất cả' },
    { label: 'Meta: Fresh' },
    { label: 'CRM: Fresh' },
  ];

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Marketing Performance"
        subtitle="Theo dõi hiệu quả đầu tư quảng cáo, chất lượng lead và chuyển đổi Marketing."
        showFreshness
      >
        <div className="cc-page">
          <CcPageToolbar compare={compare} onCompareChange={setCompare} chips={chips} />
          {error ? <p className="error">{error}</p> : null}
          <CcKpiTiles tiles={data.tiles} loading={loading} testIdPrefix="mkt" />
          <div className="cc-row cc-row--2">
            <MktMediaChart marketing={marketing} testId="mkt-media-chart" />
            <MktChannelDonut marketing={marketing} testId="mkt-channel-donut" />
          </div>
          <div className="cc-row cc-row--2">
            <CcFunnel funnel={data.funnel} title="Funnel Marketing" testId="mkt-funnel" />
            <CcAtRisk items={data.at_risk} title="Cảnh báo Marketing" testId="mkt-alerts" />
          </div>
          <div className="cc-row cc-row--3 cc-row--mkt-bottom">
            <MktCampaignTable marketing={marketing} testId="mkt-campaigns" />
            <MktCreatives marketing={marketing} testId="mkt-creatives" />
            <CcDataTrust trust={data.trust} testId="mkt-trust" />
          </div>
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
