'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubAlertList } from '@/components/kpi-hub/dashboard/KpiHubAlertList';
import { KpiHubChannelChart } from '@/components/kpi-hub/dashboard/KpiHubChannelChart';
import { KpiHubDashCards } from '@/components/kpi-hub/dashboard/KpiHubDashCards';
import { KpiHubDashFilters } from '@/components/kpi-hub/dashboard/KpiHubDashFilters';
import { KpiHubDrilldown } from '@/components/kpi-hub/dashboard/KpiHubDrilldown';
import { KpiHubFunnel } from '@/components/kpi-hub/dashboard/KpiHubFunnel';
import { KpiHubTargetDonut } from '@/components/kpi-hub/dashboard/KpiHubTargetDonut';
import { KpiHubTopSales } from '@/components/kpi-hub/dashboard/KpiHubTopSales';
import { useKpiHubDashboard } from '@/hooks/useKpiHubDashboard';
import { getAccessToken } from '@/lib/auth';
import type { KpiHubDashboardCard, KpiHubDashboardFilters } from '@/lib/kpi-hub-types';

export default function KpiHubDashboardPage() {
  const token = getAccessToken() ?? '';
  const [filters, setFilters] = useState<KpiHubDashboardFilters>({});
  const [selectedCard, setSelectedCard] = useState<KpiHubDashboardCard | null>(null);
  const { data, loading, error } = useKpiHubDashboard(token, filters);

  const cardsWithBreakdown = useMemo(
    () =>
      data.cards.map((card) => ({
        ...card,
        formulaDisplay: card.formulaDisplay ?? `${card.name} — định nghĩa KPI Hub`,
        breakdown: card.breakdown?.length
          ? card.breakdown
          : [
              { label: 'Actual', value: card.formatted },
              { label: 'Target', value: card.target != null ? String(card.target) : '—' },
            ],
      })),
    [data.cards],
  );

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Dashboard"
        subtitle="Tổng quan hiệu quả Marketing & Sales"
        breadcrumb={[{ label: 'Tổng quan' }, { label: 'Dashboard' }]}
        showFreshness
        actions={
          <>
            <span className="kpi-hub-date-chip">{data.periodLabel}</span>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
              So sánh kỳ trước
            </button>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--icon" aria-label="Xuất">
              ↓
            </button>
            <Link href="/crm/kpi-hub/reports/new" className="kpi-hub-btn kpi-hub-btn--primary">
              Tạo báo cáo
            </Link>
          </>
        }
      >
        {error ? <p className="error">{error}</p> : null}
        <div className={`kpi-hub-page-with-drawer${selectedCard ? ' has-drawer' : ''}`}>
          <div className="kpi-hub-page-with-drawer__main">
            <KpiHubDashFilters
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters({})}
            />
            <KpiHubDashCards
              cards={cardsWithBreakdown}
              loading={loading}
              onSelect={setSelectedCard}
            />
            <div className="kpi-hub-dash-row kpi-hub-dash-row--2">
              <KpiHubFunnel funnel={data.funnel} />
              <KpiHubTargetDonut targetProgress={data.targetProgress} />
            </div>
            <div className="kpi-hub-dash-row kpi-hub-dash-row--3">
              <KpiHubChannelChart channels={data.channels} />
              <KpiHubAlertList alerts={data.alerts} />
              <KpiHubTopSales topSales={data.topSales} />
            </div>
          </div>
          <KpiHubDrilldown card={selectedCard} onClose={() => setSelectedCard(null)} />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}
