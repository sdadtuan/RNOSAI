'use client';

import { useCallback, useEffect, useState } from 'react';
import { SegmentedControl } from '@/components/layout';
import { PortalAttributionFooter } from '@/components/PortalAttributionFooter';
import { PerformanceTable } from '@/components/PerformanceTable';
import {
  fetchPerformance,
  performanceExportUrl,
  type PerformanceChannel,
  type PerformanceListResponse,
} from '@/lib/api';
import { dateRangeEndingYesterday, fmtDate, fmtNumber, fmtPct, fmtVnd } from '@/lib/format';
import { LEAD_MAPPED_LABEL, LEAD_MAPPED_TIP } from '@/lib/portal/dashboard-range';

type WindowDays = 7 | 30;
type GroupBy = 'day' | 'campaign';

export interface PerformancePanelProps {
  token: string;
  channel?: PerformanceChannel;
  title: string;
  subtitle?: string;
  hideChannelColumn?: boolean;
  embedded?: boolean;
  /** Meta ad account digits (no act_ prefix); omit for all accounts / dashboard overview */
  accountId?: string;
  /** When set (dashboard), drives the fetch and hides the local T-7/T-30 toggle. */
  range?: { from: string; to: string };
  rangeLabel?: string;
}

export function PerformancePanel({
  token,
  channel,
  title,
  subtitle,
  hideChannelColumn = false,
  embedded = false,
  accountId,
  range: controlledRange,
  rangeLabel,
}: PerformancePanelProps) {
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [performance, setPerformance] = useState<PerformanceListResponse | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(true);
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState<'csv' | 'pdf' | null>(null);

  const range = controlledRange ?? dateRangeEndingYesterday(windowDays);
  const activeRangeLabel = rangeLabel ?? (controlledRange ? '' : `T-${windowDays}`);

  const loadPerformance = useCallback(
    async (authToken: string, group: GroupBy) => {
      setLoadingPerf(true);
      setError('');
      const window = controlledRange ?? dateRangeEndingYesterday(windowDays);
      try {
        const data = await fetchPerformance(authToken, {
          from: window.from,
          to: window.to,
          group_by: group,
          channel,
          account_id: accountId,
        });
        setPerformance(data);
      } catch (err) {
        setPerformance(null);
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu hiệu quả');
      } finally {
        setLoadingPerf(false);
      }
    },
    [channel, accountId, controlledRange, windowDays],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadPerformance(token, groupBy);
  }, [token, groupBy, loadPerformance]);

  const summary = performance?.summary;

  async function handleExport(format: 'csv' | 'pdf') {
    setExportBusy(format);
    setError('');
    if (format === 'pdf') {
      window.print();
      setExportBusy(null);
      return;
    }
    try {
      const url = performanceExportUrl({
        from: range.from,
        to: range.to,
        group_by: groupBy,
        channel,
        account_id: accountId,
        format,
      });
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        throw new Error(`Không tải được tệp (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'hieu-qua-quang-cao.csv';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải tệp thất bại');
    } finally {
      setExportBusy(null);
    }
  }

  const rootClass = embedded ? 'performance-panel performance-panel--embedded' : 'card performance-panel';

  return (
    <section className={rootClass}>
      <div className="performance-panel__head">
        <div className="performance-panel__intro">
          <h3 className="performance-panel__title">{title}</h3>
          {performance ? (
            <p className="muted performance-panel__meta">
              {subtitle ? `${subtitle} · ` : ''}
              {fmtDate(performance.date_from)} → {fmtDate(performance.date_to)} ·{' '}
              {summary?.campaigns_tracked ?? 0} chiến dịch
            </p>
          ) : null}
        </div>
        <div className="performance-panel__toolbar">
          {controlledRange ? null : (
            <SegmentedControl
              label="Khoảng"
              value={windowDays === 7 ? 't7' : 't30'}
              onChange={(value) => setWindowDays(value === 't7' ? 7 : 30)}
              options={[
                { id: 't7', label: 'T-7' },
                { id: 't30', label: 'T-30' },
              ]}
            />
          )}
          <SegmentedControl
            label="Nhóm"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { id: 'day', label: 'Theo ngày' },
              { id: 'campaign', label: 'Theo chiến dịch' },
            ]}
          />
          <div className="performance-panel__exports">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={exportBusy !== null || loadingPerf}
              onClick={() => void handleExport('csv')}
            >
              {exportBusy === 'csv' ? 'Đang tải…' : 'Tải CSV'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={exportBusy !== null || loadingPerf}
              onClick={() => void handleExport('pdf')}
            >
              {exportBusy === 'pdf' ? 'Đang mở…' : 'Tải PDF'}
            </button>
          </div>
        </div>
      </div>

      {summary ? (
        <div className="kpi-tile-grid performance-panel__summary">
          <div className="kpi-tile">
            <p className="kpi-tile__label">Tổng chi tiêu</p>
            <p className="kpi-tile__value">{fmtVnd(summary.total_spend)}</p>
            {activeRangeLabel ? <p className="kpi-tile__hint muted">{activeRangeLabel}</p> : null}
          </div>
          <div className="kpi-tile" data-testid="perf-leads-mapped">
            <p className="kpi-tile__label" title={LEAD_MAPPED_TIP}>{LEAD_MAPPED_LABEL}</p>
            <p className="kpi-tile__value">{fmtNumber(summary.total_leads_crm)}</p>
            {activeRangeLabel ? <p className="kpi-tile__hint muted">{activeRangeLabel}</p> : null}
          </div>
          <div className="kpi-tile">
            <p className="kpi-tile__label">CPL trung bình</p>
            <p className="kpi-tile__value">{summary.avg_cpl != null ? fmtVnd(summary.avg_cpl) : '—'}</p>
            {activeRangeLabel ? <p className="kpi-tile__hint muted">{activeRangeLabel}</p> : null}
          </div>
          <div className={`kpi-tile${summary.over_target_rows > 0 ? ' kpi-tile--critical' : ''}`}>
            <p className="kpi-tile__label">Vượt CPL mục tiêu</p>
            <p className="kpi-tile__value">{fmtNumber(summary.over_target_rows)}</p>
            {activeRangeLabel ? <p className="kpi-tile__hint muted">{activeRangeLabel}</p> : null}
          </div>
          <div className="kpi-tile">
            <p className="kpi-tile__label">Chiến dịch đang theo dõi</p>
            <p className="kpi-tile__value">{fmtNumber(summary.campaigns_tracked)}</p>
            {activeRangeLabel ? <p className="kpi-tile__hint muted">{activeRangeLabel}</p> : null}
          </div>
          {performance.unmapped_spend_pct != null ? (
            <div className="kpi-tile">
              <p className="kpi-tile__label">Chi tiêu chưa gắn chiến dịch</p>
              <p className="kpi-tile__value">{fmtPct(performance.unmapped_spend_pct)}</p>
              {activeRangeLabel ? <p className="kpi-tile__hint muted">{activeRangeLabel}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {loadingPerf ? (
        <p className="muted">Đang tải dữ liệu hiệu quả…</p>
      ) : performance && performance.rows.length === 0 ? (
        <div className="portal-empty-state">
          <p className="portal-empty-state__title">Chưa có dữ liệu trong khoảng {activeRangeLabel || ('T-' + String(windowDays))}</p>
          <p className="muted portal-empty-state__hint">
            Dữ liệu có thể chưa đồng bộ hoặc chưa gắn chiến dịch. Liên hệ AM nếu cần hỗ trợ.
          </p>
        </div>
      ) : performance ? (
        <>
          <PerformanceTable
            rows={performance.rows}
            groupBy={performance.group_by}
            hideChannel={hideChannelColumn}
          />
          <PortalAttributionFooter performance={performance} />
        </>
      ) : null}
    </section>
  );
}
