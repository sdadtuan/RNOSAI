'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  exportRevopsReportCsv,
  fetchRevopsReports,
  type RevopsReportsDto,
} from '@/lib/crm/revops-api';
import { formatRevopsVndCompact } from '@/lib/crm/revops-format';
import { useToast } from '@/lib/toast';
import { RevOpsQuickCreateButton } from './RevOpsModalsProvider';
import { useRevopsPage } from './RevOpsShell';

const BU_OPTIONS = [
  { value: 'all', label: 'Tất cả Business Unit' },
  { value: 'hn', label: 'Hà Nội' },
  { value: 'hcm', label: 'Hồ Chí Minh' },
  { value: 'dn', label: 'Đà Nẵng' },
];

function currentPeriodValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function barHeight(value: number | null, max: number): number {
  if (value == null || max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

function formatReportUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function mixTagClass(key: string): string {
  if (key === 'renewal') return 'revops-tag revops-tag--green';
  if (key === 'upsell') return 'revops-tag revops-tag--purple';
  return 'revops-tag revops-tag--blue';
}

export function RevOpsReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useRevopsPage();
  const { push } = useToast();

  const period = searchParams.get('period') ?? currentPeriodValue();
  const bu = searchParams.get('bu') ?? 'all';
  const territory = searchParams.get('territory') ?? 'all';

  const [data, setData] = useState<RevopsReportsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(
        await fetchRevopsReports(token, {
          period,
          bu: bu === 'all' ? undefined : bu,
          territory: territory === 'all' ? undefined : territory,
        }),
      );
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được reports');
    } finally {
      setLoading(false);
    }
  }, [bu, period, territory, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function setFilters(next: { period?: string; bu?: string; territory?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.period) params.set('period', next.period);
    if (next.bu) params.set('bu', next.bu);
    if (next.territory) params.set('territory', next.territory);
    router.replace(`?${params.toString()}`);
  }

  const trendMax = useMemo(() => {
    if (!data) return 1;
    const values = data.cards.revenueVsForecast.points.flatMap((p) =>
      [p.actualVnd, p.forecastVnd].filter((v): v is number => v != null),
    );
    return Math.max(1, ...values);
  }, [data]);

  async function onExportDashboard() {
    if (!token || !data?.library[0]) return;
    await onExportReport(data.library[0].slug);
  }

  async function onExportReport(slug: string) {
    if (!token) return;
    setExporting(slug);
    try {
      const { filename, csv } = await exportRevopsReportCsv(token, slug, {
        period,
        bu: bu === 'all' ? undefined : bu,
        territory: territory === 'all' ? undefined : territory,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      push('Đã export CSV', 'success');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Export thất bại', 'error');
    } finally {
      setExporting(null);
    }
  }

  const territoryOptions = data?.territoryOptions ?? [{ value: 'all', label: 'Tất cả territory' }];

  return (
    <>
      <header className="revops-page-head">
        <div>
          <h1>Reports & Forecast</h1>
          <p>Phân tích doanh thu, hiệu suất Sales/Account, forecast, retention và commission liability.</p>
        </div>
        <div className="revops-page-actions">
          <button type="button" className="revops-btn" disabled title="Wave 4 — lưu layout dashboard">
            Lưu dashboard
          </button>
          <button
            type="button"
            className="revops-btn"
            disabled={!data || exporting != null}
            onClick={() => void onExportDashboard()}
          >
            {exporting ? 'Đang export…' : '⇩ Export'}
          </button>
          <button type="button" className="revops-btn revops-btn--primary" disabled title="Custom report — sau W4">
            ＋ Custom report
          </button>
          <RevOpsQuickCreateButton />
        </div>
      </header>

      <div className="revops-filters-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <label className="revops-filter">
          <span className="revops-sr-only">Kỳ</span>
          <input
            type="month"
            className="revops-btn revops-btn--filter"
            value={period}
            onChange={(ev) => setFilters({ period: ev.target.value })}
          />
        </label>
        <select
          className="revops-btn revops-btn--filter"
          value={bu}
          onChange={(ev) => setFilters({ bu: ev.target.value })}
        >
          {BU_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              BU: {opt.label}
            </option>
          ))}
        </select>
        <select
          className="revops-btn revops-btn--filter"
          value={territory}
          onChange={(ev) => setFilters({ territory: ev.target.value })}
        >
          {territoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Territory: {opt.label}
            </option>
          ))}
        </select>
        <span className="revops-btn revops-btn--filter" aria-disabled>
          Currency: VND
        </span>
        <button type="button" className="revops-btn revops-btn--sm" onClick={() => void load()}>
          Làm mới
        </button>
      </div>

      {loading ? <p className="revops-muted">Đang tải…</p> : null}
      {error ? <p className="revops-error">{error}</p> : null}

      {data ? (
        <>
          <div className="revops-grid-3">
            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Revenue actual vs forecast</h2>
                <span className="revops-tag revops-tag--blue">{data.cards.revenueVsForecast.periodLabel}</span>
              </div>
              <div className="revops-chart-bars">
                {data.cards.revenueVsForecast.points.map((p) => (
                  <div key={p.month} className="revops-bar-group">
                    <div className="revops-bar-stack">
                      <div
                        className="revops-bar revops-bar--actual"
                        style={{ height: `${barHeight(p.actualVnd, trendMax)}%` }}
                        title={p.actualVnd != null ? formatRevopsVndCompact(p.actualVnd) : '—'}
                      />
                      <div
                        className="revops-bar revops-bar--target"
                        style={{ height: `${barHeight(p.forecastVnd, trendMax)}%` }}
                        title={p.forecastVnd != null ? formatRevopsVndCompact(p.forecastVnd) : '—'}
                      />
                    </div>
                    <label>{p.label}</label>
                  </div>
                ))}
              </div>
              <div className="revops-chart-legend">
                <span>■ Actual</span>
                <span style={{ color: '#60a5fa' }}>■ Forecast</span>
              </div>
            </section>

            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Revenue mix</h2>
                <span className="revops-tag revops-tag--green">Actual</span>
              </div>
              {data.cards.revenueMix.totalVnd <= 0 ? (
                <p className="revops-muted">Chưa có dữ liệu mix.</p>
              ) : (
                <ul className="revops-list">
                  {data.cards.revenueMix.rows.map((row) => (
                    <li key={row.key} className="revops-list-row">
                      <div>
                        <b>{row.label}</b>
                        <p className="revops-muted">
                          {formatRevopsVndCompact(row.vnd)}
                          {row.pct != null ? ` · ${row.pct}%` : ''}
                        </p>
                      </div>
                      {row.pct != null ? <span className={mixTagClass(row.key)}>{row.pct}%</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Commission liability</h2>
                <span className="revops-tag revops-tag--purple">{data.filters.periodLabel}</span>
              </div>
              <p className="revops-metric-value">{formatRevopsVndCompact(data.cards.commissionLiability.totalVnd)}</p>
              <ul className="revops-list">
                <li className="revops-list-row">
                  <div>
                    <b>Approved</b>
                  </div>
                  <span>{formatRevopsVndCompact(data.cards.commissionLiability.approvedVnd)}</span>
                </li>
                <li className="revops-list-row">
                  <div>
                    <b>Pending approval</b>
                  </div>
                  <span>{formatRevopsVndCompact(data.cards.commissionLiability.pendingVnd)}</span>
                </li>
                <li className="revops-list-row">
                  <div>
                    <b>Clawback pending</b>
                  </div>
                  <span className="revops-down">
                    {formatRevopsVndCompact(data.cards.commissionLiability.clawbackVnd)}
                  </span>
                </li>
              </ul>
            </section>
          </div>

          <section className="revops-panel" style={{ marginTop: '1.5rem' }}>
            <div className="revops-panel-head">
              <h2>Report library</h2>
              <span className="revops-tag revops-tag--gray">{data.library.length} reports</span>
            </div>
            <table className="revops-table">
              <thead>
                <tr>
                  <th>Báo cáo</th>
                  <th>Nhóm</th>
                  <th>Owner</th>
                  <th>Schedule</th>
                  <th>Last updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.library.map((row) => (
                  <tr key={row.slug}>
                    <td>
                      <b>{row.name}</b>
                      <div className="revops-muted">{row.description}</div>
                    </td>
                    <td>{row.group}</td>
                    <td>{row.owner}</td>
                    <td>
                      {row.scheduleLabel}
                      <div className="revops-muted">Scheduler: {row.schedulerStatus}</div>
                    </td>
                    <td>{formatReportUpdated(row.lastUpdated)}</td>
                    <td>
                      <button
                        type="button"
                        className="revops-btn revops-btn--sm"
                        disabled={exporting === row.slug}
                        onClick={() => void onExportReport(row.slug)}
                      >
                        {exporting === row.slug ? '…' : 'Export CSV'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="revops-muted" style={{ marginTop: '1rem' }}>
            SLA snapshot: compliance {data.slaSnapshot.compliancePct ?? '—'}% · breaches {data.slaSnapshot.breaches} ·
            dữ liệu lúc {new Date(data.fetchedAt).toLocaleString('vi-VN')}
          </p>
        </>
      ) : null}
    </>
  );
}
