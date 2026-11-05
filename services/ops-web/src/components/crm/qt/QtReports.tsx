'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  QtApiError,
  exportQtReports,
  getQtReports,
  type QtReportEngagementItem,
  type QtReportFunnelStep,
  type QtReportLossReason,
  type QtReportMarginGroup,
  type QtReportResponse,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import {
  detectPeriod,
  periodRange,
  withDefaultOverviewPeriod,
} from './QtOverview';

export const QT_REPORT_TABS = [
  { id: 'rpt-01', label: 'Điều hành' },
  { id: 'rpt-02', label: 'Funnel' },
  { id: 'rpt-03', label: 'Margin' },
  { id: 'rpt-04', label: 'Lý do thua' },
  { id: 'rpt-05', label: 'Tương tác' },
] as const;

export type QtReportTabId = (typeof QT_REPORT_TABS)[number]['id'];

export const QT_RPT01_TILES = [
  { key: 'sent_count', label: 'Quote đã gửi', hint: 'số + giá trị payable' },
  { key: 'sent_to_viewed', label: 'Được xem', hint: 'sent-to-viewed' },
  { key: 'sent_to_accepted', label: 'Đã xác nhận', hint: 'sent-to-accepted' },
  { key: 'avg_approval_hours', label: 'Avg. approval', hint: 'giờ trung bình' },
] as const;

const FUNNEL_STEPS = ['Draft', 'Sent', 'Viewed', 'Accepted'] as const;

const TAB_FROM_QUERY: Record<string, QtReportTabId> = {
  'rpt-01': 'rpt-01',
  executive: 'rpt-01',
  'rpt-02': 'rpt-02',
  funnel: 'rpt-02',
  'rpt-03': 'rpt-03',
  margin: 'rpt-03',
  'rpt-04': 'rpt-04',
  loss: 'rpt-04',
  'rpt-05': 'rpt-05',
  engagement: 'rpt-05',
};

const TAB_TO_API: Record<QtReportTabId, string> = {
  'rpt-01': 'executive',
  'rpt-02': 'funnel',
  'rpt-03': 'margin',
  'rpt-04': 'loss',
  'rpt-05': 'engagement',
};

const LOSS_LABEL: Record<string, string> = {
  budget: 'Ngân sách không phù hợp',
  competitor: 'Chọn đối thủ',
  priority: 'Đổi ưu tiên nội bộ',
  scope: 'Scope / timeline',
  other: 'Khác',
};

export function asReportTab(value: string | null | undefined): QtReportTabId {
  const key = String(value ?? '').trim().toLowerCase();
  return TAB_FROM_QUERY[key] ?? 'rpt-01';
}

function asScope(value: string | null): 'me' | 'team' | 'all' {
  if (value === 'team' || value === 'all') return value;
  return 'me';
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return dash(null);
  return `${value.toLocaleString('vi-VN')} ₫`;
}

function formatRate(value: number | null | undefined): string {
  if (value == null) return dash(null);
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

function formatHours(value: number | null | undefined): string {
  if (value == null) return dash(null);
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}h`;
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return dash(null);
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : value;
}

function executiveValue(
  key: (typeof QT_RPT01_TILES)[number]['key'],
  data: QtReportResponse | null,
): string {
  if (!data) return dash(null);
  if (key === 'sent_count') {
    return data.sent_count == null ? dash(null) : String(data.sent_count);
  }
  if (key === 'sent_to_viewed') return formatRate(data.sent_to_viewed);
  if (key === 'sent_to_accepted') return formatRate(data.sent_to_accepted);
  return formatHours(data.avg_approval_hours);
}

function executiveHint(
  key: (typeof QT_RPT01_TILES)[number]['key'],
  fallback: string,
  data: QtReportResponse | null,
): string {
  if (key === 'sent_count') {
    return data ? `${formatMoney(data.sent_value_vnd)} payable` : fallback;
  }
  return fallback;
}

function EmptyTable({ columns }: { columns: string[] }) {
  return (
    <div className="qt-table-wrap">
      <table className="qt-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="qt-empty" colSpan={columns.length}>
              {dash(null)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function QtReportsChrome({
  tab = 'rpt-01',
  onTab,
  data = null,
  period = '',
  scope = 'me',
  onPeriod,
  onScope,
  onExport,
  error,
}: {
  tab?: QtReportTabId;
  onTab?: (id: QtReportTabId) => void;
  data?: QtReportResponse | null;
  period?: string;
  scope?: 'me' | 'team' | 'all';
  onPeriod?: (preset: string) => void;
  onScope?: (scope: 'me' | 'team' | 'all') => void;
  onExport?: () => void;
  error?: string;
}) {
  const active = asReportTab(tab);
  const steps: QtReportFunnelStep[] = data?.steps ?? [];
  const groups: QtReportMarginGroup[] = data?.groups ?? [];
  const reasons: QtReportLossReason[] = data?.reasons ?? [];
  const items: QtReportEngagementItem[] = data?.items ?? [];

  return (
    <div className="qt-reports">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Báo cáo</p>
          <h1>Báo cáo</h1>
          <p className="qt-muted">RPT-01…05 · kỳ + scope · doanh thu agency không cộng media</p>
        </div>
        <div className="qt-head__actions">
          {onPeriod ? (
            <label className="qt-scope">
              <span>Kỳ</span>
              <select
                aria-label="Kỳ"
                value={period}
                onChange={(event) => onPeriod(event.target.value)}
              >
                {period === '' ? <option value="">Chọn kỳ</option> : null}
                <option value="7d">7 ngày</option>
                <option value="30d">30 ngày</option>
                <option value="month">Tháng này</option>
                <option value="quarter">Quý này</option>
              </select>
            </label>
          ) : null}
          {onScope ? (
            <label className="qt-scope">
              <span>Phạm vi</span>
              <select
                aria-label="Phạm vi"
                value={scope}
                onChange={(event) => onScope(event.target.value as 'me' | 'team' | 'all')}
              >
                <option value="me">Của tôi</option>
                <option value="team">Team</option>
                <option value="all">Toàn PTT</option>
              </select>
            </label>
          ) : null}
          {onExport ? (
            <button type="button" className="qt-btn" onClick={onExport}>
              Xuất
            </button>
          ) : null}
        </div>
      </header>
      <div className="qt-tabs">
        {QT_REPORT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`qt-tab${item.id === active ? ' qt-tab--on' : ''}`}
            onClick={onTab ? () => onTab(item.id) : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      {active === 'rpt-01' ? (
        <section>
          <h2>Báo cáo điều hành</h2>
          <div className="qt-tiles">
            {QT_RPT01_TILES.map((tile) => (
              <article className="qt-tile" key={tile.key}>
                <span>{tile.label}</span>
                <strong>{executiveValue(tile.key, data)}</strong>
                <em>{executiveHint(tile.key, tile.hint, data)}</em>
              </article>
            ))}
          </div>
          <p className="qt-muted">
            Win rate dashboard = accepted/(accepted+rejected). Báo cáo này ghi sent-to-accepted riêng.
          </p>
        </section>
      ) : null}

      {active === 'rpt-02' ? (
        <section>
          <h2>Funnel chuyển đổi</h2>
          {FUNNEL_STEPS.map((step) => {
            const row = steps.find((item) => item.step.toLowerCase() === step.toLowerCase());
            const label =
              row == null
                ? dash(null)
                : `${row.count} · ${formatRate(row.rate)} / ${row.denominator}`;
            return (
              <div className="qt-side-row" key={step}>
                <span>{step}</span>
                <b>{label}</b>
              </div>
            );
          })}
        </section>
      ) : null}

      {active === 'rpt-03' ? (
        <section>
          <h2>Margin theo nhóm dịch vụ</h2>
          <p className="qt-muted">RPT-03 · NSR fee-only · không cộng media</p>
          {groups.length ? (
            <div className="qt-table-wrap">
              <table className="qt-table">
                <thead>
                  <tr>
                    <th>Nhóm</th>
                    <th>NSR</th>
                    <th>Direct cost</th>
                    <th>GM</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((row) => (
                    <tr key={row.group}>
                      <td>{row.group}</td>
                      <td>{formatMoney(row.nsr_vnd)}</td>
                      <td>{formatMoney(row.direct_cost_vnd)}</td>
                      <td>{formatRate(row.gm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyTable columns={['Nhóm', 'NSR', 'Direct cost', 'GM']} />
          )}
        </section>
      ) : null}

      {active === 'rpt-04' ? (
        <section>
          <h2>Lý do thua quote</h2>
          {reasons.length ? (
            <div className="qt-card">
              {reasons.map((row) => (
                <div className="qt-side-row" key={row.reason}>
                  <span>{LOSS_LABEL[row.reason] ?? row.reason}</span>
                  <b>{formatRate(row.share)}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="qt-card">
              <div className="qt-side-row">
                <span>Lost reason</span>
                <b>{dash(null)}</b>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {active === 'rpt-05' ? (
        <section>
          <h2>Tương tác proposal</h2>
          {items.length ? (
            <div className="qt-table-wrap">
              <table className="qt-table">
                <thead>
                  <tr>
                    <th>Quote</th>
                    <th>First view</th>
                    <th>Last</th>
                    <th>Section sâu</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.proposal_id}>
                      <td>{dash(row.quote_code)}</td>
                      <td>{formatWhen(row.first_view)}</td>
                      <td>{formatWhen(row.last_view)}</td>
                      <td>{dash(row.section)}</td>
                      <td>{row.comment_count == null ? dash(null) : row.comment_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyTable columns={['Quote', 'First view', 'Last', 'Section sâu', 'Comment']} />
          )}
        </section>
      ) : null}
    </div>
  );
}

export function QtReports() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals/reports';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const tab = useMemo(() => asReportTab(current.get('tab')), [current]);
  const scope = asScope(current.get('scope'));
  const from = current.get('from') || undefined;
  const to = current.get('to') || undefined;
  const [data, setData] = useState<QtReportResponse | null>(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    if (from && to) return;
    const next = withDefaultOverviewPeriod(current);
    router.replace(`${pathname}?${next.toString()}`);
  }, [current, from, pathname, router, to]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !from || !to) return;
    setError('');
    try {
      const next = await getQtReports(token, {
        tab: TAB_TO_API[tab],
        from,
        to,
        scope,
      });
      setData(next);
    } catch (caught) {
      setData(null);
      if (caught instanceof QtApiError && caught.status === 403) {
        setError(
          caught.code === 'missing_cap' || /missing_cap/i.test(caught.message)
            ? 'Thiếu quyền crm_quote.finance'
            : caught.message,
        );
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Không tải được báo cáo');
    }
  }, [from, scope, tab, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(current);
    mutate(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function changeTab(next: QtReportTabId) {
    replaceParams((params) => {
      if (next === 'rpt-01') params.delete('tab');
      else params.set('tab', next);
    });
  }

  function changePeriod(preset: string) {
    const range = periodRange(preset);
    replaceParams((params) => {
      params.set('period', preset);
      params.set('from', range.from);
      params.set('to', range.to);
    });
  }

  function changeScope(next: 'me' | 'team' | 'all') {
    replaceParams((params) => {
      if (next === 'me') params.delete('scope');
      else params.set('scope', next);
    });
  }

  async function exportCsv() {
    const token = getAccessToken();
    if (!token) return;
    setExportError('');
    try {
      const out = await exportQtReports(token, {
        tab: TAB_TO_API[tab],
        from,
        to,
        scope,
      });
      const blob = new Blob([out.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = out.filename || 'quote-reports.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'Không xuất được báo cáo');
    }
  }

  const period = detectPeriod(from ?? '', to ?? '', undefined, current.get('period'));

  return (
    <QtReportsChrome
      tab={tab}
      onTab={changeTab}
      data={data}
      period={period}
      scope={scope}
      onPeriod={changePeriod}
      onScope={changeScope}
      onExport={() => void exportCsv()}
      error={error || exportError}
    />
  );
}
