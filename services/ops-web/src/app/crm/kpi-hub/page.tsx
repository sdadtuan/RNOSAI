'use client';

import Link from 'next/link';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubAlertList } from '@/components/kpi-hub/dashboard/KpiHubAlertList';
import { KpiHubChannelChart } from '@/components/kpi-hub/dashboard/KpiHubChannelChart';
import { KpiHubDashCards } from '@/components/kpi-hub/dashboard/KpiHubDashCards';
import { KpiHubDashFilters } from '@/components/kpi-hub/dashboard/KpiHubDashFilters';
import { KpiHubFunnel } from '@/components/kpi-hub/dashboard/KpiHubFunnel';
import { KpiHubTargetDonut } from '@/components/kpi-hub/dashboard/KpiHubTargetDonut';
import { KpiHubTopSales } from '@/components/kpi-hub/dashboard/KpiHubTopSales';
import { KPI_HUB_DASHBOARD } from '@/lib/kpi-hub-fixtures';

export default function KpiHubDashboardPage() {
  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Dashboard"
        subtitle="Tổng quan hiệu quả Marketing & Sales"
        breadcrumb={[{ label: 'Tổng quan' }, { label: 'Dashboard' }]}
        showFreshness
        actions={
          <>
            <span className="kpi-hub-date-chip">{KPI_HUB_DASHBOARD.periodLabel}</span>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
              So sánh kỳ trước
            </button>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--icon" aria-label="Xuất">
              ↓
            </button>
            <Link href="/crm/kpi-hub/reports" className="kpi-hub-btn kpi-hub-btn--primary">
              Tạo báo cáo
            </Link>
          </>
        }
      >
        <KpiHubDashFilters />
        <KpiHubDashCards />
        <div className="kpi-hub-dash-row kpi-hub-dash-row--2">
          <KpiHubFunnel />
          <KpiHubTargetDonut />
        </div>
        <div className="kpi-hub-dash-row kpi-hub-dash-row--3">
          <KpiHubChannelChart />
          <KpiHubAlertList />
          <KpiHubTopSales />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
