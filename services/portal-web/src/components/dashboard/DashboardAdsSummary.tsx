'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdsFreshnessBar } from '@/components/portal/AdsFreshnessBar';
import { PortalDonutChart } from '@/components/dashboard/PortalDonutChart';
import { useVisiblePoll } from '@/hooks/useVisiblePoll';
import { fetchPerformance, type PerformanceListResponse, type PerformanceRow } from '@/lib/api';
import { ctrPercent, fmtNumber, fmtPct, fmtVnd } from '@/lib/format';
import {
  adsChannelBreakdown,
  adsSummarySpend,
  adsTotalsFromRows,
  fmtCompactVnd,
  periodDeltaPct,
  previousEqualWindow,
  type ChannelBreakdownRow,
  type ChannelCountRow,
} from '@/lib/portal/dashboard-conversion.util';
import { PORTAL_ADS_POLL_MS, adsLoadMode } from '@/lib/portal/ads-live-refresh';
import type { DashboardRange } from '@/lib/portal/dashboard-range';
import { usePortalAdsChannelIds } from '@/lib/portal/ads-channels';

type DashboardAdsSummaryProps = {
  token: string;
  range: DashboardRange;
  leadsReceived: number | null;
  messagesReceived: number | null;
  leads?: ChannelCountRow[];
  messages?: ChannelCountRow[];
};

type SplitPiece = { id: string; label: string; color: string; value: number; display: string };

function shortChannelLabel(id: string, fallback: string): string {
  if (id === 'zalo') return 'Zalo';
  if (id === 'google') return 'Google';
  if (id === 'meta') return 'Meta';
  return fallback;
}

function splitFromBreakdown(
  rows: ChannelBreakdownRow[],
  metric: 'spend' | 'leads' | 'messages',
): SplitPiece[] {
  const pieces = rows.map((row) => {
    const value = metric === 'spend' ? row.spend : metric === 'leads' ? row.leads : row.messages;
    return {
      id: row.id,
      label: shortChannelLabel(row.id, row.label),
      color: row.color,
      value,
      display: metric === 'spend' ? fmtCompactVnd(value) : fmtNumber(value),
    };
  });
  return pieces;
}

function ctrSplit(rows: PerformanceRow[], channels: ChannelBreakdownRow[]): SplitPiece[] {
  return channels.map((row) => {
    const subset = rows.filter((item) => String(item.channel || '').toLowerCase() === row.id);
    const totals = adsTotalsFromRows(subset);
    return {
      id: row.id,
      label: shortChannelLabel(row.id, row.label),
      color: row.color,
      value: totals.ctr ?? 0,
      display: totals.ctr != null && totals.impressions > 0 ? fmtPct(totals.ctr, 1) : '—',
    };
  });
}

function miniBarWeights(pieces: SplitPiece[], mode: 'value' | 'ctr', spendRows?: PerformanceRow[]): number[] {
  if (mode === 'ctr' && spendRows) {
    return pieces.map((piece) => {
      const subset = spendRows.filter((item) => String(item.channel || '').toLowerCase() === piece.id);
      return adsTotalsFromRows(subset).clicks || 0;
    });
  }
  return pieces.map((piece) => Math.max(0, piece.value));
}

function PeriodDelta({ value, previousLabel, testId }: { value: number | null; previousLabel: string; testId: string }) {
  if (value == null) return <span className="kpi-tile__delta kpi-tile__delta--placeholder" data-testid={testId} />;
  const kind = value > 0.05 ? 'up' : value < -0.05 ? 'down' : 'flat';
  const arrow = kind === 'up' ? '▲' : kind === 'down' ? '▼' : '●';
  return (
    <span
      className={`kpi-tile__delta kpi-tile__delta--${kind}`}
      data-testid={testId}
      title={`So với kỳ trước (${previousLabel})`}
    >
      {arrow} {fmtPct(Math.abs(value), 1)}
    </span>
  );
}

function ChannelSplit({ pieces, weights, testId }: { pieces: SplitPiece[]; weights: number[]; testId: string }) {
  if (!pieces.length) return null;
  const total = weights.reduce((sum, n) => sum + n, 0);
  return (
    <div className="kpi-tile__split" data-testid={testId}>
      <div className="kpi-tile__mini-bar" aria-hidden="true">
        {pieces.map((piece, index) => {
          const share = total > 0 ? (weights[index] / total) * 100 : 0;
          if (share <= 0) return null;
          return (
            <span
              key={piece.id}
              className="kpi-tile__mini-bar-seg"
              style={{ width: `${Math.max(share, 2)}%`, background: piece.color }}
            />
          );
        })}
      </div>
      <p className="kpi-tile__split-text">
        {pieces.map((piece, index) => (
          <span key={piece.id} className="kpi-tile__split-item">
            {index > 0 ? <span className="kpi-tile__split-sep"> · </span> : null}
            <span className="kpi-tile__split-dot" style={{ background: piece.color }} />
            {piece.label} {piece.display}
          </span>
        ))}
      </p>
    </div>
  );
}

function formatPrevLabel(from: string, to: string): string {
  const fmt = (ymd: string) => {
    const [, m, d] = ymd.split('-');
    return `${d}/${m}`;
  };
  return from === to ? fmt(from) : `${fmt(from)}–${fmt(to)}`;
}

export function DashboardAdsSummary({
  token,
  range,
  leadsReceived,
  messagesReceived,
  leads,
  messages,
}: DashboardAdsSummaryProps) {
  const connectedIds = usePortalAdsChannelIds();
  const [performance, setPerformance] = useState<PerformanceListResponse | null>(null);
  const [prevPerformance, setPrevPerformance] = useState<PerformanceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const performanceRef = useRef(performance);
  performanceRef.current = performance;

  const prevWindow = previousEqualWindow(range.from, range.to);

  const load = useCallback(
    async (reason: 'poll' | 'user') => {
      const mode = adsLoadMode(performanceRef.current != null, reason);
      if (mode === 'quiet') setRefreshing(true);
      else setLoading(true);
      const prev = previousEqualWindow(range.from, range.to);
      try {
        const data = await fetchPerformance(token, {
          from: range.from,
          to: range.to,
          group_by: 'day',
        });
        setPerformance(data);
        setUpdatedAt(new Date());
        setError('');
      } catch (err) {
        if (mode === 'full') {
          setPerformance(null);
          setError(err instanceof Error ? err.message : 'Không tải được tóm tắt quảng cáo');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
      if (prev) {
        try {
          const prior = await fetchPerformance(token, {
            from: prev.from,
            to: prev.to,
            group_by: 'day',
          });
          setPrevPerformance(prior);
        } catch {
          setPrevPerformance(null);
        }
      } else {
        setPrevPerformance(null);
      }
    },
    [token, range.from, range.to],
  );

  useEffect(() => {
    void load('user');
  }, [load]);

  useVisiblePoll(() => {
    void load('poll');
  }, PORTAL_ADS_POLL_MS, Boolean(token));

  const spend = adsSummarySpend(performance);
  const totals = performance ? adsTotalsFromRows(performance.rows) : null;
  const ctr = totals?.ctr ?? (performance ? ctrPercent(0, 0) : null);
  const breakdown = adsChannelBreakdown({
    connectedIds,
    spendRows: performance?.rows ?? [],
    leads,
    messages,
    from: range.from,
    to: range.to,
  });
  const donutSlices = breakdown
    .filter((row) => row.spend > 0)
    .map((row) => ({
      id: row.id,
      label: row.label,
      value: row.spend,
      color: row.color,
    }));
  const showSkeleton = loading && !performance;

  const prevSpend = adsSummarySpend(prevPerformance);
  const prevHasPerf = Boolean(prevPerformance && prevPerformance.rows.length > 0);
  const prevCtr = prevHasPerf ? adsTotalsFromRows(prevPerformance!.rows).ctr : null;
  const prevCounts = prevWindow
    ? adsChannelBreakdown({
        connectedIds,
        spendRows: prevPerformance?.rows ?? [],
        leads,
        messages,
        from: prevWindow.from,
        to: prevWindow.to,
      })
    : [];
  const prevLeads = prevCounts.reduce((sum, row) => sum + row.leads, 0);
  const prevMessages = prevCounts.reduce((sum, row) => sum + row.messages, 0);
  const spendDelta = prevHasPerf ? periodDeltaPct(spend, prevSpend) : null;
  const leadDelta = prevLeads > 0 ? periodDeltaPct(leadsReceived, prevLeads) : null;
  const messageDelta = prevMessages > 0 ? periodDeltaPct(messagesReceived, prevMessages) : null;
  const ctrDelta = prevHasPerf ? periodDeltaPct(ctr, prevCtr) : null;
  const prevLabel = prevWindow ? formatPrevLabel(prevWindow.from, prevWindow.to) : '';

  const spendSplit = splitFromBreakdown(breakdown, 'spend');
  const leadSplit = splitFromBreakdown(breakdown, 'leads');
  const messageSplit = splitFromBreakdown(breakdown, 'messages');
  const channelCtr = ctrSplit(performance?.rows ?? [], breakdown);

  const kpis = (
    <div className="dashboard-ads-summary__kpis">
      <div className="kpi-tile" data-testid="ads-summary-spend">
        <div className="kpi-tile__top">
          <p className="kpi-tile__label">Chi tiêu</p>
          <PeriodDelta value={showSkeleton ? null : spendDelta} previousLabel={prevLabel} testId="ads-summary-spend-delta" />
        </div>
        <p className="kpi-tile__value">{showSkeleton ? '—' : spend != null ? fmtVnd(spend) : '—'}</p>
        {!showSkeleton ? (
          <ChannelSplit pieces={spendSplit} weights={miniBarWeights(spendSplit, 'value')} testId="ads-summary-spend-split" />
        ) : (
          <div className="kpi-tile__split kpi-tile__split--skeleton" />
        )}
      </div>
      <Link href="/crm/leads" className="kpi-tile-link" data-testid="dash-leads-received">
        <div className="kpi-tile" data-testid="ads-summary-leads">
          <div className="kpi-tile__top">
            <p className="kpi-tile__label">Lead nhận được</p>
            <PeriodDelta value={leadDelta} previousLabel={prevLabel} testId="ads-summary-leads-delta" />
          </div>
          <p className="kpi-tile__value">{leadsReceived != null ? fmtNumber(leadsReceived) : '—'}</p>
          <ChannelSplit pieces={leadSplit} weights={miniBarWeights(leadSplit, 'value')} testId="ads-summary-leads-split" />
        </div>
      </Link>
      <Link href="/crm/messages" className="kpi-tile-link" data-testid="dash-messages-received">
        <div className="kpi-tile" data-testid="ads-summary-messages">
          <div className="kpi-tile__top">
            <p className="kpi-tile__label">Tin nhắn</p>
            <PeriodDelta value={messageDelta} previousLabel={prevLabel} testId="ads-summary-messages-delta" />
          </div>
          <p className="kpi-tile__value">
            {messagesReceived != null ? fmtNumber(messagesReceived) : '—'}
          </p>
          <ChannelSplit pieces={messageSplit} weights={miniBarWeights(messageSplit, 'value')} testId="ads-summary-messages-split" />
        </div>
      </Link>
      <div className="kpi-tile" data-testid="ads-summary-ctr">
        <div className="kpi-tile__top">
          <p className="kpi-tile__label" title="Tỷ lệ nhấp — số nhấp chia cho số lần hiển thị">
            CTR
          </p>
          <PeriodDelta value={showSkeleton ? null : ctrDelta} previousLabel={prevLabel} testId="ads-summary-ctr-delta" />
        </div>
        <p className="kpi-tile__value">{showSkeleton ? '—' : ctr != null ? fmtPct(ctr, 2) : '—'}</p>
        {!showSkeleton ? (
          <ChannelSplit
            pieces={channelCtr}
            weights={miniBarWeights(channelCtr, 'ctr', performance?.rows ?? [])}
            testId="ads-summary-ctr-split"
          />
        ) : (
          <div className="kpi-tile__split kpi-tile__split--skeleton" />
        )}
      </div>
    </div>
  );

  const panel = (
    <aside className="dashboard-ads-summary__panel" data-testid="ads-summary-channel-panel">
      <p className="dashboard-ads-summary__panel-title">Chi tiêu theo kênh</p>
      <PortalDonutChart
        testId="ads-summary-spend-donut"
        ariaLabel="Chi tiêu theo kênh quảng cáo"
        center={!showSkeleton && spend != null && spend > 0 ? fmtVnd(spend) : '—'}
        sublabel="Tổng chi"
        slices={donutSlices.length ? donutSlices : [{ id: 'empty', label: 'Chưa có chi tiêu', value: 0 }]}
        size={208}
        thickness={24}
        gapRatio={0.012}
        trackColor="#ffffff"
        showLegend={false}
      />
      <ul className="ads-channel-breakdown" data-testid="ads-channel-breakdown">
        {(showSkeleton ? [0, 1] : breakdown).map((row, index) => {
          if (showSkeleton || typeof row === 'number') {
            return (
              <li key={index} className="ads-channel-breakdown__row ads-channel-breakdown__row--skeleton">
                <span className="ads-channel-breakdown__dot" />
                <div className="ads-channel-breakdown__body">
                  <p className="ads-channel-breakdown__name">…</p>
                  <div className="ads-channel-breakdown__bar" />
                </div>
              </li>
            );
          }
          return (
            <li key={row.id} className="ads-channel-breakdown__row">
              <span className="ads-channel-breakdown__dot" style={{ background: row.color }} />
              <div className="ads-channel-breakdown__body">
                <div className="ads-channel-breakdown__top">
                  <strong className="ads-channel-breakdown__name">{row.label}</strong>
                  <span className="ads-channel-breakdown__spend">
                    {fmtVnd(row.spend)}
                    <span className="muted"> · {fmtPct(row.percent, 1)}</span>
                  </span>
                </div>
                <div className="ads-channel-breakdown__bar" aria-hidden="true">
                  <span
                    className="ads-channel-breakdown__bar-fill"
                    style={{ width: `${Math.max(row.percent, row.spend > 0 ? 2 : 0)}%`, background: row.color }}
                  />
                </div>
                <p className="muted ads-channel-breakdown__meta">
                  Lead {fmtNumber(row.leads)} · Tin nhắn {fmtNumber(row.messages)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );

  return (
    <section className="dashboard-ads-summary" data-testid="dashboard-ads-summary">
      <div className="dashboard-ads-summary__head">
        <div>
          <h2 className="portal-hub-section__title">Quảng cáo</h2>
          <p className="muted dashboard-ads-summary__sub">Tóm tắt chi tiêu và hiệu quả — {range.label}</p>
        </div>
        <div className="dashboard-ads-summary__actions">
          <AdsFreshnessBar updatedAt={updatedAt} refreshing={refreshing} />
          <Link href="/meta" className="btn btn-secondary btn-sm" data-testid="dashboard-ads-details">
            Xem chi tiết
          </Link>
        </div>
      </div>

      {error && !performance ? <p className="error">{error}</p> : null}

      <div className="dashboard-ads-summary__body" aria-busy={showSkeleton || undefined}>
        {panel}
        {kpis}
      </div>
    </section>
  );
}
