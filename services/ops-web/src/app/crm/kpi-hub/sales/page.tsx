'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { CcAtRisk } from '@/components/kpi-hub/command-center/CcAtRisk';
import { CcDataTrust } from '@/components/kpi-hub/command-center/CcDataTrust';
import { CcFunnel } from '@/components/kpi-hub/command-center/CcFunnel';
import { CcKpiTiles } from '@/components/kpi-hub/command-center/CcKpiTiles';
import { CcPageToolbar } from '@/components/kpi-hub/command-center/CcPageToolbar';
import { SalesDealsAtRisk } from '@/components/kpi-hub/command-center/SalesDealsAtRisk';
import { SalesPipelineChart } from '@/components/kpi-hub/command-center/SalesPipelineChart';
import { SalesSlaGauge } from '@/components/kpi-hub/command-center/SalesSlaGauge';
import { SalesTeamTable } from '@/components/kpi-hub/command-center/SalesTeamTable';
import { useKpiHubCommandCenter } from '@/hooks/useKpiHubCommandCenter';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';

const DEFAULT_SALES = {
  pipeline_stacks: [],
  sla: { actual_minutes: null, target_minutes: 30, buckets: {}, overdue_count: 0 },
  team_rows: [],
  deals_at_risk: [],
  weighted_badge: 'unweighted' as const,
};

export default function SalesCommandCenterPage() {
  const token = getAccessToken() ?? '';
  const user = getStoredUser();
  const [compare, setCompare] = useState(true);
  const query = useMemo(() => ({ compare }), [compare]);
  const { data, loading, error } = useKpiHubCommandCenter(token, 'sales', query);
  const sales = data.sales ?? DEFAULT_SALES;
  const canCreateDeal = user ? hasCap(user, 'crm_leads', 'edit') : false;

  const chips = [
    { label: 'Team: Tất cả' },
    { label: 'Nguồn lead: Tất cả' },
    { label: 'Pipeline: Tất cả' },
    { label: 'Khu vực: Tất cả' },
  ];

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Sales Command Center"
        subtitle="Theo dõi pipeline, hiệu suất team, SLA xử lý lead và dự báo doanh thu."
        showFreshness
      >
        <div className="cc-page">
          <CcPageToolbar
            compare={compare}
            onCompareChange={setCompare}
            chips={chips}
            extraActions={
              canCreateDeal ? (
                <Link href="/crm/leads/new" className="kpi-hub-btn kpi-hub-btn--primary">
                  + Tạo Deal
                </Link>
              ) : null
            }
          />
          {error ? <p className="error">{error}</p> : null}
          <CcKpiTiles
            tiles={data.tiles}
            loading={loading}
            testIdPrefix="sales"
            weightedBadge={sales.weighted_badge}
          />
          <div className="cc-row cc-row--2">
            <SalesPipelineChart sales={sales} testId="sales-pipeline" />
            <SalesSlaGauge sales={sales} testId="sales-sla-gauge" />
          </div>
          <div className="cc-row cc-row--2">
            <CcFunnel funnel={data.funnel} title="Funnel Sales & Điểm nghẽn" testId="sales-funnel" />
            <div className="cc-alerts-panel">
              <CcAtRisk items={data.at_risk} title="Cảnh báo Sales" testId="sales-alerts" />
              <Link href="/crm/kpi-hub/targets" className="kpi-hub-btn kpi-hub-btn--ghost cc-alerts-panel__cta">
                Mở Alert Center
              </Link>
            </div>
          </div>
          <div className="cc-row cc-row--3">
            <SalesTeamTable sales={sales} testId="sales-team-table" />
            <SalesDealsAtRisk sales={sales} testId="sales-deals-risk" />
            <CcDataTrust trust={data.trust} testId="sales-trust" />
          </div>
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
