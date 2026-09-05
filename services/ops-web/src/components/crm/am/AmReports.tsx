'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { fetchAmRetentionReports, type AmReportsRetention } from '@/lib/crm/am-api';
import {
  AM_REPORT_EXPORT_TOOLTIP,
  amReportsForecastWidth,
  amReportsFormatRate,
  amReportsHeatClass,
  amReportsHideNrrNote,
  amReportsMoney,
} from '@/lib/crm/am-reports.util';
import { useAmPage } from './AmShell';

const FORECAST_LABEL: Record<AmReportsRetention['forecast'][number]['bucket'], string> = {
  committed: 'Committed',
  likely: 'Likely',
  risk: 'Risk',
  unlikely: 'Unlikely',
};

export function AmReports() {
  const { token, scope } = useAmPage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';
  const [data, setData] = useState<AmReportsRetention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(
        await fetchAmRetentionReports(token, {
          scope,
          from: fromParam || undefined,
          to: toParam || undefined,
        }),
      );
    } catch {
      setData(null);
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, [fromParam, scope, toParam, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const from = fromParam || data?.period.from || '';
  const to = toParam || data?.period.to || '';
  const kpis = data?.kpis;
  const drills = data?.drills;
  const formulas = data?.formulas;
  const forecastTotal = (data?.forecast ?? []).reduce((sum, row) => sum + (row.value_vnd ?? 0), 0);

  function setPeriod(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFrom) params.set('from', nextFrom);
    else params.delete('from');
    if (nextTo) params.set('to', nextTo);
    else params.delete('to');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?');
  }

  return (
    <section className="am-page">
      <header className="am-page__head">
        <div>
          <h1>Báo cáo Retention & Renewal</h1>
          <p className="am-muted am-reports-water">
            {data?.freshness.as_of
              ? `Dữ liệu tính đến ${data.freshness.as_of}`
              : loading
                ? '—'
                : '—'}
          </p>
        </div>
        <div className="am-reports-tools">
          <label className="am-field">
            <span>Từ</span>
            <input
              type="date"
              value={from}
              onChange={(ev) => setPeriod(ev.target.value, to)}
            />
          </label>
          <label className="am-field">
            <span>Đến</span>
            <input
              type="date"
              value={to}
              onChange={(ev) => setPeriod(from, ev.target.value)}
            />
          </label>
          <button type="button" className="am-btn" disabled title={AM_REPORT_EXPORT_TOOLTIP}>
            Export
          </button>
        </div>
      </header>

      {data?.freshness.stale ? (
        <p className="am-banner">Dữ liệu đang cũ — kiểm tra đồng bộ.</p>
      ) : null}

      {error ? (
        <div className="am-widget__error">
          <p>Không tải được báo cáo retention.</p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="am-tiles">
        <Link className="am-tile" href={drills?.logo ?? '#'} title={formulas?.logo}>
          <span>Logo Retention</span>
          <strong>{loading && !data ? '—' : amReportsFormatRate(kpis?.logo)}</strong>
        </Link>
        <Link className="am-tile" href={drills?.grr ?? '#'} title={formulas?.grr}>
          <span>GRR</span>
          <strong>{loading && !data ? '—' : amReportsFormatRate(kpis?.grr)}</strong>
        </Link>
        {data?.nrr_hidden ? (
          <article className="am-tile" title={formulas?.nrr}>
            <span>NRR</span>
            <strong>—</strong>
            <p className="am-muted">{data.note ?? amReportsHideNrrNote()}</p>
          </article>
        ) : (
          <Link className="am-tile" href={drills?.nrr ?? '#'} title={formulas?.nrr}>
            <span>NRR</span>
            <strong>{loading && !data ? '—' : amReportsFormatRate(kpis?.nrr)}</strong>
          </Link>
        )}
        <Link className="am-tile" href={drills?.churned_mrr ?? '#'} title="Churned MRR">
          <span>Churned MRR</span>
          <strong>{loading && !data ? '—' : amReportsMoney(kpis?.churned_mrr)}</strong>
        </Link>
        {data?.nrr_hidden ? (
          <article className="am-tile" title="Expansion">
            <span>Expansion</span>
            <strong>—</strong>
          </article>
        ) : (
          <Link className="am-tile" href={drills?.expansion_mrr ?? '#'} title="Expansion">
            <span>Expansion</span>
            <strong>{loading && !data ? '—' : amReportsMoney(kpis?.expansion_mrr)}</strong>
          </Link>
        )}
      </div>

      {data?.nrr_hidden && data.note ? <p className="am-reports-note">{data.note}</p> : null}

      <div className="am-split">
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Retention theo cohort</h2>
          </div>
          {!data?.cohort.length ? (
            <p className="am-muted">—</p>
          ) : (
            <div className="am-tbl-wrap">
              <table className="am-table am-reports-heat">
                <thead>
                  <tr>
                    <th>Cohort</th>
                    {data.cohort[0].cells.map((cell) => (
                      <th key={cell.period}>{cell.period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cohort.map((row) => (
                    <tr key={row.cohort}>
                      <td>{row.cohort}</td>
                      {row.cells.map((cell) => (
                        <td key={cell.period}>
                          <Link
                            className={amReportsHeatClass(cell.rate)}
                            href={cell.href}
                            title={formulas?.logo}
                          >
                            {amReportsFormatRate(cell.rate)}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Renewal forecast</h2>
          </div>
          {!data?.forecast.length ? (
            <p className="am-muted">—</p>
          ) : (
            <>
              <div className="am-stack am-reports-stack">
                {data.forecast.map((row) => (
                  <Link
                    key={row.bucket}
                    href={row.href}
                    title={FORECAST_LABEL[row.bucket]}
                    style={{ width: `${amReportsForecastWidth(row.value_vnd, forecastTotal)}%` }}
                    className={`am-reports-stack__${row.bucket}`}
                  >
                    <span className="am-sr-only">{FORECAST_LABEL[row.bucket]}</span>
                  </Link>
                ))}
              </div>
              <ul className="am-legend">
                {data.forecast.map((row) => (
                  <li key={row.bucket}>
                    <Link href={row.href}>{FORECAST_LABEL[row.bucket]}</Link>
                    {': '}
                    <Link href={row.href}>{amReportsMoney(row.value_vnd)}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="am-split">
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Churn reasons</h2>
          </div>
          {!data?.churn_reasons.length ? (
            <p className="am-muted">—</p>
          ) : (
            <div className="am-tbl-wrap">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Lý do</th>
                    <th>Số lượng</th>
                    <th>MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.churn_reasons.map((row) => (
                    <tr key={row.reason}>
                      <td>
                        <Link href={row.href}>{row.reason}</Link>
                      </td>
                      <td>
                        <Link href={row.href}>{row.count}</Link>
                      </td>
                      <td>
                        <Link href={row.href}>{amReportsMoney(row.mrr)}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Retention theo owner</h2>
          </div>
          {!data?.by_owner.length ? (
            <p className="am-muted">—</p>
          ) : (
            <div className="am-tbl-wrap">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Logo</th>
                    <th>GRR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_owner.map((row) => (
                    <tr key={String(row.owner_staff_id ?? 'unassigned')}>
                      <td>
                        <Link href={row.href}>
                          {row.owner_staff_id == null ? 'Chưa gán' : `#${row.owner_staff_id}`}
                        </Link>
                      </td>
                      <td>
                        <Link href={row.href} title={formulas?.logo}>
                          {amReportsFormatRate(row.logo)}
                        </Link>
                      </td>
                      <td>
                        <Link href={row.href} title={formulas?.grr}>
                          {amReportsFormatRate(row.grr)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
