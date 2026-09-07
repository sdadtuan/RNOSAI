'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  exportCpReport,
  formatCpApiError,
  getCpReport,
  type CpReport,
  type CpReportQuery,
  type CpReportSlug,
  type CpScope,
  type CpSourcedMetric,
} from '@/lib/crm/cp-api';
import {
  CP_REPORT_FILTERS,
  CP_REPORT_SECTIONS,
  CP_REPORT_TABS,
  MISSING_INGEST_COPY,
  dash,
  sourcedDisplay,
} from '@/lib/crm/cp-format';

const TITLES: Record<CpReportSlug, { h1: string; crumb: string; sub: string }> = {
  executive: {
    h1: 'Báo cáo điều hành',
    crumb: 'Báo cáo điều hành',
    sub: 'KPI kỳ · funnel chỉ khi có ingest · insight không nhân quả',
  },
  production: {
    h1: 'Phân tích sản xuất',
    crumb: 'Phân tích sản xuất',
    sub: 'Success · queue p95 · render p95 · lớp lỗi',
  },
  credit: {
    h1: 'Credit & ngân sách',
    crumb: 'Credit & ngân sách',
    sub: 'Used / charged / reserved / released · forecast + assumption',
  },
  performance: {
    h1: 'Hiệu quả nội dung',
    crumb: 'Hiệu quả nội dung',
    sub: 'Mọi metric có source + freshness · không bịa CTR',
  },
  governance: {
    h1: 'Quản trị',
    crumb: 'Quản trị',
    sub: 'Brand · QC · quyền 14 ngày · audit · policy',
  },
};

function asSlug(value: string | null): CpReportSlug {
  return CP_REPORT_TABS.some((tab) => tab.slug === value)
    ? (value as CpReportSlug)
    : 'executive';
}

function asScope(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function hrefWith(
  pathname: string,
  searchParams: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function asMetric(value: unknown): CpSourcedMetric {
  if (value && typeof value === 'object' && 'value' in value && 'source' in value) {
    const metric = value as CpSourcedMetric;
    return {
      value: metric.value ?? null,
      source: String(metric.source ?? 'chưa ingest'),
      freshness: metric.freshness ?? null,
    };
  }
  return { value: null, source: 'chưa ingest', freshness: null };
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? dash(null) : value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

function MetricLine({
  label,
  metric,
}: {
  label: string;
  metric: CpSourcedMetric;
}) {
  const shown = sourcedDisplay(metric);
  return (
    <p>
      {label}{' '}
      <strong>{shown.value}</strong>
      {' · '}
      source: {metric.source}
      {' · '}
      freshness: {dash(metric.freshness)}
      {shown.missing ? <em className="cp-report-missing"> {MISSING_INGEST_COPY}</em> : null}
    </p>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="cp-kpi-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em className="cp-report-missing">{hint}</em> : null}
    </div>
  );
}

function CpReportsInner() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/creative-os/reports';
  const searchParams = useSearchParams();
  const slug = asSlug(searchParams.get('tab'));
  const scope = asScope(searchParams.get('scope'));
  const [report, setReport] = useState<CpReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState({
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    client: searchParams.get('client') ?? '',
  });

  const query = useMemo<CpReportQuery>(() => ({
    scope,
    from: searchParams.get(CP_REPORT_FILTERS[0]) || undefined,
    to: searchParams.get(CP_REPORT_FILTERS[1]) || undefined,
    client: searchParams.get(CP_REPORT_FILTERS[2]) || undefined,
  }), [scope, searchParams]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReport(await getCpReport(token, slug, query));
    } catch (caught) {
      setReport(null);
      setError(formatCpApiError(caught, 'Không tải được báo cáo'));
    } finally {
      setLoading(false);
    }
  }, [query, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.replace(hrefWith(pathname, searchParams, {
      from: draft.from || null,
      to: draft.to || null,
      client: draft.client || null,
      lifecycle: null,
      project: null,
      channel: null,
      scope,
    }));
  }

  async function onExport() {
    const token = getAccessToken();
    if (!token) return;
    setExporting(true);
    try {
      const out = await exportCpReport(token, { slug, format: 'csv' }, scope);
      if (out.body) {
        const blob = new Blob([out.body], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cp-${slug}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không xuất được báo cáo'));
    } finally {
      setExporting(false);
    }
  }

  const title = TITLES[slug];
  const metrics = report?.metrics ?? {};
  const kpis = report?.kpis ?? {};
  const roi = asMetric(kpis.roi);
  const roiShown = sourcedDisplay(roi);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / {title.crumb}</p>
          <h1>{title.h1}</h1>
          <p className="cp-muted">{title.sub}</p>
        </div>
        <button className="cp-btn" type="button" disabled={exporting} onClick={() => void onExport()}>
          {exporting ? 'Đang xuất…' : 'Export CSV'}
        </button>
      </header>

      <nav className="cp-settings-tabs" aria-label="Báo cáo">
        {CP_REPORT_TABS.map((tab) => (
          <Link
            key={tab.slug}
            href={hrefWith(pathname, searchParams, { tab: tab.slug === 'executive' ? null : tab.slug })}
            className={`cp-btn${slug === tab.slug ? ' cp-btn--primary' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <form className="cp-filters" onSubmit={submitFilters}>
        <label>
          <span>Từ ngày</span>
          <input type="date" value={draft.from} onChange={(event) => setDraft((cur) => ({ ...cur, from: event.target.value }))} />
        </label>
        <label>
          <span>Đến ngày</span>
          <input type="date" value={draft.to} onChange={(event) => setDraft((cur) => ({ ...cur, to: event.target.value }))} />
        </label>
        <label>
          <span>Khách</span>
          <input value={draft.client} placeholder="Tất cả" onChange={(event) => setDraft((cur) => ({ ...cur, client: event.target.value }))} />
        </label>
        <button type="submit" className="cp-btn cp-btn--primary">Áp dụng</button>
      </form>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}

      {slug === 'executive' ? (
        <>
          <div className="cp-kpi-grid cp-kpi-grid--4">
            <Tile label="Output Final" value={formatNumber(typeof kpis.output_final === 'number' ? kpis.output_final : null)} />
            <Tile label="Credit charged" value={formatNumber(typeof kpis.credits_charged === 'number' ? kpis.credits_charged : null)} />
            <Tile label="ROI" value={roiShown.value} hint={roiShown.missing ? MISSING_INGEST_COPY : undefined} />
            <Tile label="Campaign health" value={formatNumber(typeof kpis.campaign_health === 'number' ? kpis.campaign_health : null)} />
          </div>
          <section className="cp-card">
            <header className="cp-card__head"><h2>Funnel</h2></header>
            {report?.funnel ? (
              <p>
                Views → landing → form → lead ={' '}
                {dash((report.funnel as Record<string, number | null>).views)}
                {' → '}
                {dash((report.funnel as Record<string, number | null>).landing)}
                {' → '}
                {dash((report.funnel as Record<string, number | null>).form)}
                {' → '}
                {dash((report.funnel as Record<string, number | null>).lead)}
              </p>
            ) : (
              <p className="cp-muted">
                Views → landing → form → lead = <strong>{dash(null)}</strong> · source: chưa ingest · freshness: {dash(null)}
              </p>
            )}
            <p className="cp-muted">
              {(report?.insights as { disclaimer?: string } | undefined)?.disclaimer
                ?? 'Insight không nhân quả. Không suy diễn hiệu quả ads khi thiếu ingest.'}
            </p>
          </section>
          <SectionTable
            title="Xu hướng"
            section={CP_REPORT_SECTIONS.executive[0]}
            columns={['Ngày', 'Tạo', 'Duyệt', 'Xuất bản']}
            rows={asRows(report?.trend)}
            cells={(row) => [
              dash(row.day),
              formatNumber(asNumber(row.created)),
              formatNumber(asNumber(row.approved)),
              formatNumber(asNumber(row.published)),
            ]}
          />
          <SectionTable
            title="Top creative"
            section={CP_REPORT_SECTIONS.executive[1]}
            columns={['Creative', 'Version', 'Trạng thái']}
            rows={asRows(report?.top_creative)}
            cells={(row) => [dash(row.name), dash(row.version_id), dash(row.approval_status)]}
          />
          <SectionTable
            title="Sức khỏe dự án"
            section={CP_REPORT_SECTIONS.executive[2]}
            columns={['Dự án', 'Trạng thái', 'Budget']}
            rows={asRows(report?.project_health)}
            cells={(row) => [dash(row.name), dash(row.status), formatNumber(asNumber(row.credit_budget))]}
          />
        </>
      ) : null}

      {slug === 'production' ? (
        <>
          <div className="cp-kpi-grid cp-kpi-grid--4">
            <Tile label="Success" value={formatPercent(report?.success)} />
            <Tile label="Queue wait p95" value={formatSeconds(report?.queue_p95)} />
            <Tile label="Render p95" value={formatSeconds(report?.render_p95)} />
            <Tile label="Approval cycle TB" value={formatSeconds(report?.approval_cycle)} />
          </div>
          <FailureTable rows={asRows(report?.failure_class)} />
          <SectionTable
            title="Heatmap"
            section={CP_REPORT_SECTIONS.production[0]}
            columns={['Model', 'Ngày', 'Jobs']}
            rows={asRows(report?.heatmap)}
            cells={(row) => [dash(row.model), dash(row.day), formatNumber(asNumber(row.count))]}
          />
          <SectionTable
            title="Provider health"
            section={CP_REPORT_SECTIONS.production[1]}
            columns={['Provider / model', 'Success', 'p95']}
            rows={asRows(report?.provider_health)}
            cells={(row) => [
              dash(row.id),
              formatPercent(row.success_pct),
              formatSeconds(row.p95_sec),
            ]}
          />
        </>
      ) : null}

      {slug === 'credit' ? (
        <>
          <div className="cp-kpi-grid cp-kpi-grid--4">
            <Tile label="Used" value={formatNumber(asNumber(report?.used))} />
            <Tile label="Charged" value={formatNumber(asNumber(report?.charged))} />
            <Tile label="Reserved" value={formatNumber(asNumber(report?.reserved))} />
            <Tile label="Released" value={formatNumber(asNumber(report?.released))} />
          </div>
          <SectionTable
            title="Theo pipeline"
            section={CP_REPORT_SECTIONS.credit[0]}
            columns={['Pipeline', 'Kind', 'Amount']}
            rows={asRows(report?.by_pipeline)}
            cells={(row) => [
              dash(row.pipeline),
              dash(row.kind),
              formatNumber(asNumber(row.amount)),
            ]}
          />
          <section className="cp-card">
            <header className="cp-card__head"><h2>Forecast</h2></header>
            <p>
              <strong>{formatNumber(report?.forecast?.value ?? null)}</strong>
            </p>
            <p className="cp-muted">{report?.forecast?.assumption ?? 'Forecast = scheduled_batch_credits + historical_avg + reserved.'}</p>
          </section>
        </>
      ) : null}

      {slug === 'performance' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>Kênh</h2></header>
          <MetricLine label="Views" metric={asMetric(metrics.views)} />
          <MetricLine label="CTR" metric={asMetric(metrics.ctr)} />
          <BreakdownTable rows={asRows(report?.breakdown)} />
        </section>
      ) : null}

      {slug === 'governance' ? (
        <>
          <div className="cp-kpi-grid cp-kpi-grid--4">
            <Tile label="Brand pass" value={formatNumber(asNumber(report?.brand_pass))} />
            <Tile label="QC warning" value={formatNumber(asNumber(report?.qc_warning))} />
            <Tile label="Rights ≤14d" value={formatNumber(asNumber(report?.rights_14d))} />
            <Tile label="Audit rows" value={formatNumber(asNumber(report?.audit_rows))} />
          </div>
          <section className="cp-card">
            <header className="cp-card__head"><h2>Policy</h2></header>
            <p>
              Allow {formatNumber(asNumber((report?.policy as Record<string, unknown> | undefined)?.allow))}
              {' · '}
              Review {formatNumber(asNumber((report?.policy as Record<string, unknown> | undefined)?.review))}
              {' · '}
              Block {formatNumber(asNumber((report?.policy as Record<string, unknown> | undefined)?.block))}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function formatPercent(value: unknown): string {
  const number = asNumber(value);
  if (number == null) return dash(null);
  const percent = number <= 1 ? number * 100 : number;
  return `${percent.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

function formatSeconds(value: unknown): string {
  const number = asNumber(value);
  if (number == null) return dash(null);
  const seconds = Math.max(0, Math.round(number));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}p ${remainder}s` : `${remainder}s`;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    : [];
}

function SectionTable({
  title,
  section,
  columns,
  rows,
  cells,
}: {
  title: string;
  section: string;
  columns: string[];
  rows: Record<string, unknown>[];
  cells: (row: Record<string, unknown>) => string[];
}) {
  return (
    <section className="cp-card" data-section={section}>
      <header className="cp-card__head"><h2>{title}</h2></header>
      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>
              {columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={`${section}-${index}`}>
                {cells(row).map((cell, cellIndex) => (
                  <td key={`${section}-${index}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            )) : (
              <tr>
                <td className="cp-empty" colSpan={columns.length}>{dash(null)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FailureTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <div className="cp-table-wrap">
      <table className="cp-table">
        <thead>
          <tr>
            <th>Lớp lỗi</th>
            <th>Count</th>
            <th>Retry OK</th>
            <th>Gợi ý</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={String(row.error_class ?? index)}>
              <td>{dash(row.error_class)}</td>
              <td>{formatNumber(asNumber(row.count))}</td>
              <td>{formatNumber(asNumber(row.retry_ok))}</td>
              <td>{dash(row.recommendation)}</td>
            </tr>
          )) : (
            <tr>
              <td className="cp-empty" colSpan={4}>{dash(null)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <div className="cp-table-wrap">
      <table className="cp-table">
        <thead>
          <tr>
            <th>Template / format</th>
            <th>Output</th>
            <th>Hiệu quả</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => {
            const performance = asMetric(row.performance);
            const shown = sourcedDisplay(performance);
            return (
              <tr key={String(row.key ?? index)}>
                <td>{dash(row.key)}</td>
                <td>{formatNumber(asNumber(row.output))}</td>
                <td>
                  {shown.value}
                  {shown.missing ? <em className="cp-report-missing"> {MISSING_INGEST_COPY}</em> : null}
                </td>
              </tr>
            );
          }) : (
            <tr>
              <td className="cp-empty" colSpan={3}>
                {dash(null)}
                <em className="cp-report-missing"> {MISSING_INGEST_COPY}</em>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CpReports() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpReportsInner />
    </Suspense>
  );
}
