'use client';

import Link from 'next/link';
import { formatNumber, formatPct, formatVnd } from '@/lib/kpi/format';

export interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'critical';
  href?: string;
}

export function KpiTileGrid({ tiles }: { tiles: KpiTileProps[] }) {
  return (
    <div className="kpi-tile-grid" role="list">
      {tiles.map((tile) => (
        <KpiTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}

export function KpiTile({ label, value, hint, tone = 'default', href }: KpiTileProps) {
  const body = (
    <div className={`kpi-tile kpi-tile--${tone}`} role="listitem">
      <p className="kpi-tile__label">{label}</p>
      <p className="kpi-tile__value">{value}</p>
      {hint ? <p className="kpi-tile__hint muted">{hint}</p> : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="kpi-tile-link">
        {body}
      </Link>
    );
  }
  return body;
}

export function KpiSparkline({
  data,
  width = 220,
  height = 52,
  label,
  className = 'kpi-sparkline',
}: {
  data: number[];
  width?: number;
  height?: number;
  label?: string;
  className?: string;
}) {
  if (!data.length) {
    return <span className="muted">—</span>;
  }
  const pad = 4;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export function KpiBarChart({
  title,
  items,
  unit = '%',
  maxValue,
}: {
  title: string;
  items: Array<{ label: string; value: number | null; href?: string }>;
  unit?: string;
  maxValue?: number;
}) {
  const numeric = items.map((i) => (i.value == null || !Number.isFinite(i.value) ? 0 : i.value));
  const max = maxValue ?? Math.max(...numeric, 1);

  return (
    <section className="kpi-bar-chart" aria-label={title}>
      <h3 className="kpi-section-title">{title}</h3>
      {items.length === 0 ? <p className="muted">Chưa có dữ liệu.</p> : null}
      <div className="kpi-bar-chart__rows">
        {items.map((item) => {
          const val = item.value == null || !Number.isFinite(item.value) ? 0 : item.value;
          const widthPct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
          const labelNode = item.href ? (
            <Link href={item.href} className="kpi-bar-chart__label nav-link">
              {item.label}
            </Link>
          ) : (
            <span className="kpi-bar-chart__label">{item.label}</span>
          );
          return (
            <div key={item.label} className="kpi-bar-chart__row">
              {labelNode}
              <div className="kpi-bar-chart__track" aria-hidden="true">
                <div className="kpi-bar-chart__fill" style={{ width: `${widthPct}%` }} />
              </div>
              <span className="kpi-bar-chart__value">
                {item.value == null ? '—' : unit === '₫' ? formatVnd(item.value) : `${formatNumber(item.value)}${unit}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function KpiProgressList({
  items,
  staffHref,
}: {
  items: Array<{ key: string; label: string; value: number; target?: number | null }>;
  staffHref?: string;
}) {
  if (items.length === 0) {
    return <p className="muted">Chưa có số liệu.</p>;
  }

  return (
    <ul className="kpi-progress-list">
      {items.map((item) => {
        const target = item.target != null && item.target > 0 ? item.target : null;
        const pct = target ? Math.min(100, Math.round((item.value / target) * 100)) : null;
        return (
          <li key={item.key} className="kpi-progress-item">
            <div className="kpi-progress-item__head">
              <span>{item.label}</span>
              <span className="muted">
                {formatNumber(item.value)}
                {target != null ? ` / ${formatNumber(target)}` : ''}
                {pct != null ? ` (${pct}%)` : ''}
              </span>
            </div>
            {pct != null ? (
              <div className="kpi-progress-item__track" aria-hidden="true">
                <div
                  className={`kpi-progress-item__fill${pct >= 100 ? ' kpi-progress-item__fill--ok' : pct < 70 ? ' kpi-progress-item__fill--low' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}
          </li>
        );
      })}
      {staffHref ? (
        <li className="kpi-progress-item kpi-progress-item--link">
          <Link href={staffHref} className="nav-link">
            Xem hồ sơ nhân viên →
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

function alertTone(level: unknown): 'critical' | 'warning' | 'default' {
  const raw = String(level ?? '').toLowerCase();
  if (raw === 'critical' || raw === 'crit') return 'critical';
  if (raw === 'warn' || raw === 'warning') return 'warning';
  return 'default';
}

export function KpiAlertList({
  alerts,
  emptyLabel = 'Không có cảnh báo.',
}: {
  alerts: Array<Record<string, unknown>>;
  emptyLabel?: string;
}) {
  if (alerts.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <ul className="kpi-alert-list">
      {alerts.map((alert, index) => {
        const tone = alertTone(alert.level ?? alert.severity);
        const title = String(alert.title ?? alert.message ?? alert.metric_name ?? 'Cảnh báo');
        const detail = String(alert.message ?? alert.reason ?? '');
        const staff = alert.staff_name ? String(alert.staff_name) : '';
        return (
          <li key={String(alert.alert_id ?? alert.kpi_id ?? alert.id ?? index)} className={`kpi-alert kpi-alert--${tone}`}>
            <span className={`kpi-alert__badge kpi-alert__badge--${tone}`}>
              {tone === 'critical' ? 'Nghiêm trọng' : tone === 'warning' ? 'Cảnh báo' : 'Thông tin'}
            </span>
            <div className="kpi-alert__body">
              <strong>{title}</strong>
              {detail && detail !== title ? <p className="muted kpi-alert__detail">{detail}</p> : null}
              {staff ? <p className="muted kpi-alert__meta">{staff}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function KpiTrendPanel({
  title,
  labels,
  series,
  valueFormatter,
}: {
  title: string;
  labels: string[];
  series: number[];
  valueFormatter?: (value: number) => string;
}) {
  const latest = series.length ? series[series.length - 1] : null;
  const fmt = valueFormatter ?? formatNumber;
  return (
    <div className="kpi-trend-panel">
      <p className="kpi-tile__label">{title}</p>
      <p className="kpi-tile__value">{latest == null ? '—' : fmt(latest)}</p>
      <KpiSparkline data={series} label={title} />
      {labels.length ? (
        <p className="muted kpi-trend-panel__range">
          {labels[0]} → {labels[labels.length - 1]}
        </p>
      ) : null}
    </div>
  );
}

export function extractTrendSeries(trends: Record<string, unknown> | null | undefined): {
  labels: string[];
  mrr: number[];
  concentration: number[];
  cac: number[];
} {
  const root = trends ?? {};
  const nested = (root.trends as Record<string, unknown> | undefined) ?? root;
  return {
    labels: (nested.labels as string[] | undefined) ?? [],
    mrr: (nested.mrr_bookings_vnd as number[] | undefined) ?? [],
    concentration: (nested.top2_concentration_pct as number[] | undefined) ?? [],
    cac: (nested.cac_vnd as number[] | undefined) ?? [],
  };
}

export function businessDashboardTiles(dashboard: Record<string, unknown> | null, alertCount: number): KpiTileProps[] {
  const exec = (dashboard?.exec_metrics ?? {}) as Record<string, unknown>;
  const mrr = (exec.mrr_arr ?? {}) as Record<string, unknown>;
  const ar = (dashboard?.ar_aging ?? {}) as Record<string, unknown>;
  const retention = (dashboard?.retention_metrics ?? {}) as Record<string, unknown>;

  return [
    {
      label: 'MRR bookings',
      value: formatVnd(mrr.mrr_bookings_vnd),
      hint: 'Doanh thu recurring tháng',
      tone: 'default',
      href: '/crm/financials',
    },
    {
      label: 'AR quá hạn',
      value: formatVnd(ar.total_overdue_vnd),
      hint: `Chờ thu: ${formatVnd(ar.total_pending_vnd)}`,
      tone: Number(ar.total_overdue_vnd ?? 0) > 0 ? 'warning' : 'success',
      href: '/crm/financials',
    },
    {
      label: 'Retention MoM',
      value: formatPct(retention.customer_retention_pct),
      hint: `Active KH: ${formatNumber(retention.active_customers)}`,
      tone: Number(retention.customer_retention_pct ?? 100) >= 90 ? 'success' : 'warning',
      href: '/crm/hub',
    },
    {
      label: 'Cảnh báo KPI',
      value: formatNumber(alertCount),
      hint: 'Finance + delivery + portfolio',
      tone: alertCount > 0 ? 'critical' : 'success',
      href: '/crm/kpi',
    },
  ];
}
