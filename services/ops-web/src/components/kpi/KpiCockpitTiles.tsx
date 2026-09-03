'use client';

import { KpiTile } from '@/components/kpi/KpiDashboardUi';
import type { CockpitSummary } from '@/lib/kpi/cockpit-summary';
import { formatPct } from '@/lib/kpi/format';

export function deltaHint(n: number | null | undefined, suffix: string): string | undefined {
  if (n == null) return undefined;
  if (n > 0) return `+${n} ${suffix}`;
  if (n < 0) return `${n} ${suffix}`;
  return `0 ${suffix}`;
}

export function KpiCockpitTiles({ summary }: { summary: CockpitSummary }) {
  const completionDelta =
    summary.delta.completion_pct == null
      ? null
      : Number(summary.delta.completion_pct.toFixed(1));

  return (
    <div className="kpi-tile-grid">
      <KpiTile
        label="KPI đúng tiến độ"
        value={`${summary.green}/${summary.total}`}
        hint={deltaHint(summary.delta.green, 'so với tháng trước')}
        tone="success"
      />
      <KpiTile
        label="Cần theo dõi"
        value={`${summary.yellow}`}
        hint={deltaHint(summary.delta.yellow, 'so với tháng trước')}
        tone="warning"
      />
      <KpiTile
        label="Không đạt"
        value={`${summary.red}`}
        hint={deltaHint(summary.delta.red, 'so với tháng trước')}
        tone={summary.red > 0 ? 'critical' : 'default'}
      />
      <KpiTile
        label="Tỷ lệ hoàn thành"
        value={summary.completion_pct == null ? '—' : formatPct(summary.completion_pct, 1)}
        hint={deltaHint(completionDelta, 'điểm %')}
      />
      <KpiTile
        label="Cập nhật đúng hạn"
        value={summary.ontime_pct == null ? '—' : `${summary.ontime_pct}%`}
        hint={deltaHint(summary.delta.ontime_pct, 'điểm %')}
      />
    </div>
  );
}

export default KpiCockpitTiles;
