'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type {
  ServiceKpiTrackingActualItem,
  ServiceKpiTrackingHighlight,
  ServiceKpiTrackingSummary,
} from '@/lib/service-kpi-types';

type Props = {
  summary: ServiceKpiTrackingSummary;
  recent: ServiceKpiTrackingActualItem[];
  highlight: ServiceKpiTrackingHighlight | null;
  dictionaryLabels?: Record<string, string>;
  loading?: boolean;
};

function formatVnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

function formatTargetRange(min: number | null, max: number | null): string {
  const fmtK = (v: number) => `${Math.round(v / 1000).toLocaleString('vi-VN')}K`;
  if (min != null && max != null) return `${fmtK(min)}–${fmtK(max)} ₫`;
  if (max != null) return formatVnd(max);
  if (min != null) return formatVnd(min);
  return '—';
}

function formatShortDate(iso: string): string {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return iso;
  return `${day}/${m}`;
}

function qualityBadge(status: string): { label: string; className: string } {
  if (status === 'valid') return { label: 'Verified', className: 'kpi-hub-badge--pass' };
  if (status === 'pending_validation') return { label: 'Pending', className: 'kpi-hub-badge--amber' };
  if (status === 'invalid') return { label: 'Invalid', className: 'kpi-hub-badge--critical' };
  if (status === 'estimated') return { label: 'Estimated', className: 'kpi-hub-badge--warn' };
  return { label: status, className: 'kpi-hub-badge--gray' };
}

function instanceStatusBadge(status: string): string {
  if (status === 'AT_RISK') return 'kpi-hub-badge--warn';
  if (status === 'TRACKING') return 'kpi-hub-badge--pass';
  return 'kpi-hub-badge--gray';
}

function chartBarTone(value: number | null, targetMax: number | null, variancePct: number | null): string {
  if (variancePct != null && variancePct > 10) return ' is-risk';
  if (value != null && targetMax != null && value > targetMax) return ' is-warn';
  return '';
}

export function ServiceKpiTrackingPanel({
  summary,
  recent,
  highlight,
  dictionaryLabels = {},
  loading,
}: Props) {
  const chartBars = useMemo(() => {
    if (!highlight?.actuals.length) return [];
    const sorted = [...highlight.actuals].sort((a, b) => a.period_end.localeCompare(b.period_end)).slice(-8);
    const values = sorted.map((a) => a.value).filter((v): v is number => v != null && Number.isFinite(v));
    const maxVal = Math.max(highlight.target_max ?? 0, ...values, 1);
    return sorted.map((row) => ({
      id: row.id,
      label: formatShortDate(row.period_end),
      heightPct: row.value != null ? Math.round((row.value / maxVal) * 100) : 8,
      tone: chartBarTone(row.value, highlight.target_max, highlight.variance_pct),
    }));
  }, [highlight]);

  const highlightLabel = highlight
    ? (dictionaryLabels[highlight.dictionary_id] ?? highlight.dictionary_id)
    : null;

  const latestPeriod = highlight?.actuals[0]?.period_end;

  if (loading) {
    return <p className="kpi-hub-muted">Đang tải actual tracking…</p>;
  }

  return (
    <div className="kpi-hub-skpi-tracking-layout">
      <div className="kpi-hub-skpi-tracking-main">
        {highlight ? (
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>
                {highlightLabel} — Target vs Actual
              </h2>
              <span className={`kpi-hub-badge ${instanceStatusBadge(highlight.status)}`}>
                {highlight.status === 'AT_RISK' ? 'At Risk' : highlight.status}
              </span>
            </header>
            <div className="kpi-hub-card__body">
              <div className="kpi-hub-skpi-metricgrid">
                <div className="kpi-hub-skpi-metric">
                  <span>TARGET BASE</span>
                  <b>{formatTargetRange(highlight.target_min, highlight.target_max)}</b>
                </div>
                <div className="kpi-hub-skpi-metric">
                  <span>ACTUAL {latestPeriod ? `(${formatShortDate(latestPeriod)})` : ''}</span>
                  <b>{formatVnd(highlight.latest_value)}</b>
                </div>
                <div className="kpi-hub-skpi-metric">
                  <span>VARIANCE</span>
                  <b
                    className={
                      highlight.variance_pct != null && highlight.variance_pct > 0
                        ? 'kpi-hub-skpi-metric--critical'
                        : highlight.variance_pct != null && highlight.variance_pct < 0
                          ? 'kpi-hub-skpi-metric--ok'
                          : undefined
                    }
                  >
                    {highlight.variance_pct != null
                      ? `${highlight.variance_pct > 0 ? '+' : ''}${highlight.variance_pct}%`
                      : '—'}
                  </b>
                </div>
              </div>
              {chartBars.length ? (
                <div className="kpi-hub-skpi-chartarea">
                  {chartBars.map((bar) => (
                    <div key={bar.id} className="kpi-hub-skpi-chartarea__col">
                      <i className={`kpi-hub-skpi-chartarea__bar${bar.tone}`} style={{ height: `${bar.heightPct}%` }} />
                      <span>{bar.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="kpi-hub-muted" style={{ marginTop: 12 }}>
                  Chưa có lịch sử actual cho instance này.
                </p>
              )}
            </div>
          </article>
        ) : (
          <article className="kpi-hub-card">
            <header className="kpi-hub-card__head">
              <h2>Target vs Actual</h2>
            </header>
            <div className="kpi-hub-card__body">
              <p className="kpi-hub-empty">
                Chọn instance từ URL (?instance=…) hoặc nhập actual để xem biểu đồ variance.
              </p>
            </div>
          </article>
        )}

        <article className="kpi-hub-card">
          <header className="kpi-hub-card__head">
            <h2>Actual records</h2>
            <span className="kpi-hub-muted">{recent.length} gần đây</span>
          </header>
          <div className="kpi-hub-card__body">
            {recent.length ? (
              <ul className="kpi-hub-skpi-actual-records">
                {recent.map((row) => {
                  const badge = qualityBadge(row.quality_status);
                  const label = dictionaryLabels[row.dictionary_id] ?? row.dictionary_id;
                  const source = row.source_ref?.trim() || row.collection_method || '—';
                  return (
                    <li key={row.id} className="kpi-hub-skpi-actual-row">
                      <div className="kpi-hub-skpi-actual-row__meta">
                        <Link href={`/crm/kpi-hub/tracking?instance=${row.instance_id}`}>
                          {formatShortDate(row.period_end)} · {label}
                        </Link>
                        <span>{source}</span>
                      </div>
                      <div className="kpi-hub-skpi-actual-row__value">
                        <b>{formatVnd(row.value)}</b>
                        <span className={`kpi-hub-badge ${badge.className}`}>{badge.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="kpi-hub-empty">Chưa có actual — bấm 「+ Nhập Actual」 hoặc ingest qua API.</p>
            )}
          </div>
        </article>
      </div>

      <aside className="kpi-hub-skpi-tracking-aside">
        <article className="kpi-hub-card">
          <header className="kpi-hub-card__head">
            <h2>Data quality</h2>
          </header>
          <div className="kpi-hub-card__body">
            <ul className="kpi-hub-skpi-readiness-list">
              <li className={summary.verified_pct >= 90 ? 'is-ok' : summary.verified_pct >= 70 ? 'is-warn' : ''}>
                Verified: {summary.verified_pct}%
              </li>
              <li className={summary.pending_verify ? 'is-warn' : 'is-ok'}>
                Pending verify: {summary.pending_verify}
              </li>
              <li className={summary.stale_count ? 'is-warn' : 'is-ok'}>
                Stale instances: {summary.stale_count}
              </li>
              <li className={summary.duplicate_count ? 'is-warn' : 'is-ok'}>
                Duplicate actuals: {summary.duplicate_count}
              </li>
            </ul>
          </div>
        </article>
        <article className="kpi-hub-card">
          <div className="kpi-hub-card__body kpi-hub-skpi-tracking-aside__actions">
            <Link href="/crm/kpi-hub/targets" className="kpi-hub-btn kpi-hub-btn--ghost">
              Target &amp; Cảnh báo
            </Link>
            <Link href="/crm/kpi-hub/measurement" className="kpi-hub-btn kpi-hub-btn--ghost">
              Measurement Plan
            </Link>
          </div>
        </article>
      </aside>
    </div>
  );
}

export function trackingSummaryTiles(summary: ServiceKpiTrackingSummary) {
  const dataIssuesHint =
    summary.stale_count || summary.duplicate_count
      ? `${String(summary.stale_count).padStart(2, '0')} stale · ${String(summary.duplicate_count).padStart(2, '0')} duplicate`
      : summary.pending_verify
        ? `${summary.pending_verify} pending verify`
        : 'Không có issue';

  return [
    {
      label: 'ACTUAL HÔM NAY',
      value: summary.today_total,
      hint: `${summary.verified_pct}% valid/verified`,
      tone: summary.today_total ? ('ok' as const) : ('default' as const),
    },
    {
      label: 'API / CONNECTOR',
      value: summary.api_connector_total,
      hint: summary.api_connector_hint,
    },
    {
      label: 'MANUAL / IMPORT',
      value: summary.manual_import_total,
      hint: summary.pending_verify ? `${summary.pending_verify} pending verify` : '—',
      tone: summary.pending_verify ? ('warn' as const) : ('default' as const),
    },
    {
      label: 'DATA ISSUES',
      value: String(summary.data_issues).padStart(2, '0'),
      hint: dataIssuesHint,
      tone: summary.data_issues ? ('critical' as const) : ('default' as const),
    },
  ];
}
