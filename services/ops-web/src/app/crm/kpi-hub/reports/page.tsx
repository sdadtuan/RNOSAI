'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  KpiHubReportList,
  KpiHubReportRail,
  KpiHubReportSummaryCards,
  KpiHubReportTabs,
} from '@/components/kpi-hub/reports/KpiHubReportPanels';
import { getAccessToken } from '@/lib/auth';
import { fetchKpiHubReports } from '@/lib/kpi-hub-api';
import { KPI_HUB_REPORTS } from '@/lib/kpi-hub-fixtures';
import { normalizeReports } from '@/lib/kpi-hub-normalize';

type ReportsData = ReturnType<typeof normalizeReports>;

export default function KpiHubReportsPage() {
  const token = getAccessToken() ?? '';
  const [tab, setTab] = useState('Tất cả');
  const [data, setData] = useState<ReportsData>(KPI_HUB_REPORTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchKpiHubReports(token)
      .then((raw) => {
        if (!cancelled) setData(normalizeReports(raw as Record<string, unknown>));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được báo cáo');
          setData(KPI_HUB_REPORTS);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filteredItems =
    tab === 'Của tôi'
      ? data.items.filter((item) => item.owner.includes('Trần') || item.owner.includes('Phạm'))
      : tab === 'Đã chia sẻ'
        ? data.items.filter((item) => item.status === 'ACTIVE')
        : tab === 'Lịch gửi'
          ? data.items.filter((item) => item.type === 'Dashboard')
          : data.items;

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
            <Link href="/crm/kpi-hub/reports/new" className="kpi-hub-btn kpi-hub-btn--primary">
              + Tạo báo cáo
            </Link>
          </>
        }
      >
        {error ? <p className="error">{error}</p> : null}
        <KpiHubReportSummaryCards summary={data.summary} loading={loading} />
        <KpiHubReportTabs tabs={data.tabs} active={tab} onChange={setTab} />
        <div className="kpi-hub-tab-panel kpi-hub-tab-panel--split">
          <div className="kpi-hub-tab-panel__main">
            {loading ? (
              <div className="kpi-hub-table-wrap kpi-hub-skeleton-table">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="kpi-hub-skeleton kpi-hub-skeleton--line" />
                ))}
              </div>
            ) : (
              <KpiHubReportList items={filteredItems} />
            )}
          </div>
          <KpiHubReportRail
            quickCreate={data.quickCreate}
            nextSchedule={data.nextSchedule}
            recentShares={data.recentShares}
          />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
