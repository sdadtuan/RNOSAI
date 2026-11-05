'use client';

import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import { formatPct } from '@/lib/kpi/format';
import type { LmpDiscoverAnalyticsMetrics } from '@/lib/ai-api';

type Props = {
  metrics: LmpDiscoverAnalyticsMetrics | null;
  days: number;
  loading?: boolean;
};

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = Math.round(sec / 60);
  return `${min} phút`;
}

export function DiscoverInsightsPanel({ metrics, days, loading }: Props) {
  if (loading && !metrics) {
    return <p className="muted">Đang tải KPI Discover…</p>;
  }

  const m = metrics;
  const tiles: KpiTileProps[] = [
    {
      label: 'Discover hit rate',
      value: m?.discover_hit_rate_pct == null ? '—' : formatPct(m.discover_hit_rate_pct),
      hint: `${m?.discover_hits ?? 0}/${m?.discover_attempts ?? 0} lần tìm DN · ${days} ngày`,
      tone:
        m?.discover_hit_rate_pct == null
          ? 'default'
          : m.discover_hit_rate_pct >= 50
            ? 'success'
            : 'warning',
    },
    {
      label: 'AM override',
      value: m?.am_override_rate_pct == null ? '—' : formatPct(m.am_override_rate_pct),
      hint: `${m?.am_override_count ?? 0} AM xác nhận/nhập · target ≤40%`,
      tone:
        m?.am_override_rate_pct == null
          ? 'default'
          : m.am_override_rate_pct <= 40
            ? 'success'
            : 'warning',
    },
    {
      label: 'Time-to-ready p95',
      value: formatDuration(m?.time_to_ready_p95_sec),
      hint: 'DISC-03 · target ≤5 phút',
      tone:
        m?.time_to_ready_p95_sec == null
          ? 'default'
          : m.time_to_ready_p95_sec <= 300
            ? 'success'
            : 'warning',
    },
    {
      label: 'Cache hit',
      value: String(m?.cache_hit_count ?? 0),
      hint: 'Discover tái sử dụng SĐT/email · TTL 7 ngày',
    },
    {
      label: 'Tìm thấy 1 DN',
      value: String(m?.found_single_count ?? 0),
      hint: 'found_single',
      tone: 'success',
    },
    {
      label: 'Nhiều DN',
      value: String(m?.found_multiple_count ?? 0),
      hint: 'Cần AM chọn pháp nhân',
    },
    {
      label: 'Không tìm thấy',
      value: String(m?.not_found_count ?? 0),
      hint: 'AM nhập tay',
      tone: (m?.not_found_count ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      label: 'M1 ready',
      value: String(m?.m1_ready_count ?? 0),
      hint: 'Prep sẵn sàng sau discover',
    },
  ];

  return (
    <section className="ai-insights-page__section" style={{ marginTop: '1.5rem' }}>
      <h3 className="kpi-section-title">Discover Identity · KPI</h3>
      <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
        Lead chỉ SĐT/email → AI tìm doanh nghiệp trước Sales Cockpit. DISC-02 target hit ≥50%.
      </p>
      <KpiTileGrid tiles={tiles} />
    </section>
  );
}
