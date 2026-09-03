'use client';

import { useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  KpiHubQualityFreshness,
  KpiHubQualityIssueDrawer,
  KpiHubQualityRulesTable,
  KpiHubQualityScore,
  KpiHubQualitySummaryCards,
  KpiHubQualityTrend,
} from '@/components/kpi-hub/quality/KpiHubQualityPanels';

export default function KpiHubQualityPage() {
  const [issueOpen, setIssueOpen] = useState(false);

  return (
    <KpiHubPageGate section="crm_kpi_quality">
      <KpiHubShell
        title="Data Quality"
        subtitle="Giám sát chất lượng dữ liệu KPI Hub"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Data Quality' }]}
        actions={
          <>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
              Xuất báo cáo
            </button>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--primary">
              Chạy kiểm tra
            </button>
          </>
        }
      >
        <div className={`kpi-hub-page-with-drawer${issueOpen ? ' has-drawer' : ''}`}>
          <div className="kpi-hub-page-with-drawer__main">
            <div className="kpi-hub-quality-top">
              <KpiHubQualityScore />
              <KpiHubQualitySummaryCards />
            </div>
            <div className="kpi-hub-dash-row kpi-hub-dash-row--2">
              <KpiHubQualityTrend />
              <KpiHubQualityFreshness />
            </div>
            <KpiHubQualityRulesTable onSelectIssue={() => setIssueOpen(true)} />
          </div>
          <KpiHubQualityIssueDrawer open={issueOpen} onClose={() => setIssueOpen(false)} />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
