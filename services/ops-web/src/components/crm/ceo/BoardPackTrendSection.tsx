'use client';

import { KpiSparkline } from '@/components/kpi/KpiDashboardUi';
import type { TowerTrendPayload } from '@/lib/crm/ceo-tower-api';
import { formatTowerWowDelta } from '@/lib/crm/ceo-tower-ui.util';

export type BoardPackTrendFacts = {
  labels?: string[];
  total_issues?: number[];
  red_issues?: number[];
  wow?: TowerTrendPayload['wow'];
};

export function BoardPackTrendSection({ trends }: { trends: BoardPackTrendFacts | undefined }) {
  if (!trends?.total_issues?.length) return null;

  const labels = trends.labels ?? [];
  const total = trends.total_issues ?? [];
  const red = trends.red_issues ?? [];
  const wow = trends.wow;

  return (
    <section className="board-pack-section" data-testid="ceo-board-pack-trends">
      <h2>Xu hướng 7 ngày</h2>
      {wow ? (
        <p className="board-pack-trend-wow">
          So 7 ngày trước: <strong>{formatTowerWowDelta(wow)}</strong> sót (
          {wow.prev_week_total} → {wow.current_total})
        </p>
      ) : null}
      <div className="board-pack-trend-charts">
        <div className="board-pack-trend-chart">
          <p className="board-pack-trend-label">Tổng sót</p>
          <KpiSparkline
            data={total}
            width={260}
            height={48}
            label="Tổng sót 7 ngày"
            className="board-pack-trend-sparkline"
          />
        </div>
        <div className="board-pack-trend-chart">
          <p className="board-pack-trend-label">Đỏ</p>
          <KpiSparkline
            data={red}
            width={260}
            height={48}
            label="Sót đỏ 7 ngày"
            className="board-pack-trend-sparkline board-pack-trend-sparkline--red"
          />
        </div>
      </div>
      <table className="board-pack-table board-pack-trend-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Tổng</th>
            <th>Đỏ</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={`${label}-${index}`}>
              <td>{label}</td>
              <td>{total[index] ?? 0}</td>
              <td>{red[index] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
