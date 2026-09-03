'use client';

import { useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  KpiHubReportList,
  KpiHubReportRail,
  KpiHubReportSummaryCards,
  KpiHubReportTabs,
} from '@/components/kpi-hub/reports/KpiHubReportPanels';

export default function KpiHubReportsPage() {
  const [tab, setTab] = useState('Tất cả');

  return (
    <KpiHubPageGate section="crm_kpi_hub_reports">
      <KpiHubShell
        title="Báo cáo"
        subtitle="Thư viện mẫu, lịch gửi và chia sẻ báo cáo KPI"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Báo cáo' }]}
        showFreshness
        actions={
          <>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
              Thư viện mẫu
            </button>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
              Lịch gửi báo cáo
            </button>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--primary">
              + Tạo báo cáo
            </button>
          </>
        }
      >
        <KpiHubReportSummaryCards />
        <KpiHubReportTabs active={tab} onChange={setTab} />
        <div className="kpi-hub-tab-panel kpi-hub-tab-panel--split">
          <div className="kpi-hub-tab-panel__main">
            <KpiHubReportList />
          </div>
          <KpiHubReportRail />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
