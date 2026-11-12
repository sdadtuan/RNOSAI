'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPortalCrmPages,
  fetchPortalMetaAdInsights,
  portalMetaAdInsightsExportUrl,
  syncPortalMetaAdAccount,
  type PortalCrmPage,
  type PortalMetaAdInsightsResponse,
} from '@/lib/api';
import { fmtDate, fmtNumber, fmtPct, fmtVnd } from '@/lib/format';
import {
  receivedDay,
  countInRange,
  groupCountByDay,
  groupCountByCampaign,
  LEAD_RECEIVED_LABEL,
  LEAD_RECEIVED_TIP,
  LEAD_PLATFORM_TIP,
} from '@/lib/portal/dashboard-range';

const ALL_ACCOUNTS_VALUE = 'all';
type RangePreset = 7 | 14 | 30 | 90 | 'custom';
const MAX_CUSTOM_RANGE_DAYS = 37 * 30;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeEndingToday(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  return { since: isoDay(since), until: isoDay(until) };
}

function validateCustomDateRange(since: string, until: string): string | null {
  if (!since || !until) return 'Chọn đủ ngày Từ và Đến.';
  if (since > until) return 'Ngày Từ phải không sau ngày Đến.';
  const span = Math.ceil((Date.parse(until) - Date.parse(since)) / 86400000) + 1;
  if (span > MAX_CUSTOM_RANGE_DAYS) return 'Khoảng ngày tối đa 37 tháng.';
  return null;
}

function countLeadsByDay(leads: PortalMetaAdInsightsResponse['leads']): Map<string, number> {
  const map = new Map<string, number>();
  for (const lead of leads) {
    const day = lead.created_at.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return map;
}

function countLeadsByCampaignId(leads: PortalMetaAdInsightsResponse['leads']): Map<string, number> {
  const map = new Map<string, number>();
  for (const lead of leads) {
    const id = (lead.campaign_id ?? '').trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

function formatAdAccountOption(page: PortalCrmPage): string {
  return page.page_name?.trim() || 'Tài khoản quảng cáo';
}

type TableTab = 'campaign' | 'adset' | 'ad' | 'breakdown';

type ReceivedLead = {
  created_at?: string;
  last_interaction_at?: string;
  campaign_id?: string | null;
};

type PortalCrmAdsLeadReportProps = {
  token: string;
  embedded?: boolean;
  accountId?: string;
  onAccountIdChange?: (id: string) => void;
  adAccounts?: PortalCrmPage[];
  adAccountsLoaded?: boolean;
  canSync?: boolean;
  /** Shared dashboard range — hides the local date picker when set. */
  range?: { since: string; until: string };
  rangeLabel?: string;
  receivedLeads?: ReceivedLead[];
};

export function PortalCrmAdsLeadReport({
  token,
  embedded = false,
  accountId: controlledAccountId,
  onAccountIdChange,
  adAccounts: controlledAccounts,
  adAccountsLoaded = false,
  canSync = false,
  range: controlledRange,
  rangeLabel,
  receivedLeads,
}: PortalCrmAdsLeadReportProps) {
  const [localAccounts, setLocalAccounts] = useState<PortalCrmPage[]>([]);
  const [localAccountsLoaded, setLocalAccountsLoaded] = useState(false);
  const [localAccountId, setLocalAccountId] = useState('');
  const [insights, setInsights] = useState<PortalMetaAdInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset>(30);
  const [customSince, setCustomSince] = useState(() => rangeEndingToday(30).since);
  const [customUntil, setCustomUntil] = useState(() => rangeEndingToday(30).until);
  const [rangeValidationError, setRangeValidationError] = useState('');
  const [tableTab, setTableTab] = useState<TableTab>('campaign');
  const [breakdownType, setBreakdownType] = useState('publisher_platform');

  const adAccounts = controlledAccounts ?? localAccounts;
  const accountsReady = controlledAccounts != null ? adAccountsLoaded : localAccountsLoaded;
  const accountId = controlledAccountId ?? localAccountId;
  const setAccountId = onAccountIdChange ?? setLocalAccountId;

  const range = useMemo(() => {
    if (controlledRange) return controlledRange;
    if (rangePreset === 'custom') {
      return { since: customSince, until: customUntil };
    }
    return rangeEndingToday(rangePreset);
  }, [controlledRange, rangePreset, customSince, customUntil]);

  const customRangeInvalid = useMemo(() => {
    if (rangePreset !== 'custom') return null;
    return validateCustomDateRange(customSince, customUntil);
  }, [rangePreset, customSince, customUntil]);

  useEffect(() => {
    if (controlledAccounts != null) return;
    let cancelled = false;
    setLoading(true);
    setLocalAccountsLoaded(false);
    void fetchPortalCrmPages(token)
      .then((res) => {
        if (cancelled) return;
        const active = (res.pages ?? []).filter((p) => p.active && p.channel === 'ad_account');
        setLocalAccounts(active);
        setLocalAccountId(active[0]?.page_id ?? '');
      })
      .catch((err) => {
        if (!cancelled) {
          setLocalAccounts([]);
          setLocalAccountId('');
          setError(err instanceof Error ? err.message : 'Không tải được danh sách tài khoản quảng cáo');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLocalAccountsLoaded(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, controlledAccounts]);

  const loadInsights = useCallback(async () => {
    if (!accountId || accountId === ALL_ACCOUNTS_VALUE || adAccounts.length === 0) {
      setInsights(null);
      setLoading(false);
      return;
    }
    if (customRangeInvalid) {
      setRangeValidationError(customRangeInvalid);
      setInsights(null);
      setLoading(false);
      return;
    }
    setRangeValidationError('');
    setLoading(true);
    setError('');
    try {
      const data = await fetchPortalMetaAdInsights(token, accountId, range);
      setInsights(data);
    } catch (err) {
      setInsights(null);
      setError(err instanceof Error ? err.message : 'Không tải được báo cáo Meta');
    } finally {
      setLoading(false);
    }
  }, [token, accountId, adAccounts.length, range, customRangeInvalid]);

  useEffect(() => {
    if (!accountsReady) return;
    void loadInsights();
  }, [accountsReady, loadInsights]);

  useEffect(() => {
    if (!accountsReady) return;
    if (!accountId || adAccounts.length === 0) {
      setInsights(null);
      setLoading(false);
    }
  }, [accountsReady, accountId, adAccounts.length]);

  const onSync = async () => {
    if (!canSync || !accountId || accountId === ALL_ACCOUNTS_VALUE) return;
    setSyncing(true);
    setError('');
    try {
      const out = await syncPortalMetaAdAccount(token, accountId, { since: range.since, until: range.until });
      if (!out.ok && out.error) setError(out.error);
      await loadInsights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đồng bộ thất bại');
    } finally {
      setSyncing(false);
    }
  };

  const leadsByDay = useMemo(() => {
    if (receivedLeads) return groupCountByDay(receivedLeads, range.since, range.until, receivedDay);
    return countLeadsByDay(insights?.leads ?? []);
  }, [receivedLeads, insights, range.since, range.until]);
  const leadsByCampaign = useMemo(() => {
    if (receivedLeads) return groupCountByCampaign(receivedLeads, range.since, range.until, receivedDay);
    return countLeadsByCampaignId(insights?.leads ?? []);
  }, [receivedLeads, insights, range.since, range.until]);
  const receivedTotal = receivedLeads
    ? countInRange(receivedLeads, range.since, range.until, receivedDay)
    : (insights?.leads.length ?? 0);

  const dailyRows = useMemo(() => {
    if (!insights) return [];
    return insights.daily.map((row) => ({
      ...row,
      leadsPortal: leadsByDay.get(row.date) ?? 0,
    }));
  }, [insights, leadsByDay]);

  const chartPoints = useMemo(() => {
    if (!dailyRows.length) return '';
    const maxSpend = Math.max(...dailyRows.map((r) => r.spend), 1);
    const w = 320;
    const h = 80;
    const step = w / Math.max(dailyRows.length - 1, 1);
    return dailyRows
      .map((r, i) => {
        const y = h - (r.spend / maxSpend) * (h - 8);
        return `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [dailyRows]);

  const portalLeadTotal = receivedTotal;
  const kpi = insights?.kpi;
  const syncMeta = insights?.sync;

  const rootClass = embedded
    ? 'performance-panel performance-panel--embedded portal-crm-ads-lead-report'
    : 'card performance-panel portal-crm-ads-lead-report';

  const showAccountPicker = adAccounts.length > 0;
  const showEmpty = accountsReady && !loading && adAccounts.length === 0;

  const tableRows =
    tableTab === 'campaign'
      ? insights?.tables.campaign ?? []
      : tableTab === 'adset'
        ? insights?.tables.adset ?? []
        : tableTab === 'ad'
          ? insights?.tables.ad ?? []
          : [];

  const breakdownRows = insights?.breakdowns?.[breakdownType] ?? [];

  return (
    <section className={rootClass}>
      <div className="performance-panel__head">
        <div className="performance-panel__intro">
          <h3 className="performance-panel__title">Báo cáo Meta Ads</h3>
          <p className="muted performance-panel__meta">
            Chi tiêu, lead và hiệu quả theo ngày và theo chiến dịch.
          </p>
        </div>
        <div className="portal-crm-ads-lead-report__toolbar">
          {showAccountPicker ? (
            <label className="portal-crm-ads-lead-report__page-pick">
              <span className="muted">Tài khoản quảng cáo</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {adAccounts.map((p) => (
                  <option key={p.page_id} value={p.page_id}>
                    {formatAdAccountOption(p)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {controlledRange ? (
            <p className="muted portal-crm-ads-lead-report__range-label">{rangeLabel}</p>
          ) : (
          <>
          <label className="portal-crm-ads-lead-report__page-pick">
            <span className="muted">Khoảng ngày</span>
            <select
              value={rangePreset}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'custom') {
                  setRangePreset('custom');
                  return;
                }
                setRangePreset(Number(v) as 7 | 14 | 30 | 90);
              }}
            >
              <option value={7}>7 ngày</option>
              <option value={14}>14 ngày</option>
              <option value={30}>30 ngày</option>
              <option value={90}>90 ngày</option>
              <option value="custom">Tùy chọn (Từ – Đến)</option>
            </select>
          </label>
          {rangePreset === 'custom' ? (
            <>
              <label className="portal-crm-ads-lead-report__page-pick">
                <span className="muted">Từ</span>
                <input type="date" value={customSince} onChange={(e) => setCustomSince(e.target.value)} />
              </label>
              <label className="portal-crm-ads-lead-report__page-pick">
                <span className="muted">Đến</span>
                <input type="date" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} />
              </label>
            </>
          ) : null}
          </>
          )}
          {canSync && accountId && accountId !== ALL_ACCOUNTS_VALUE ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={syncing || loading} onClick={() => void onSync()}>
              {syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
            </button>
          ) : null}
          {!embedded && accountId && accountId !== ALL_ACCOUNTS_VALUE ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const level = tableTab === 'breakdown' ? 'campaign' : tableTab;
                const url = portalMetaAdInsightsExportUrl(accountId, range.since, range.until, level);
                void fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                  .then((res) => res.text())
                  .then((csv) => {
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `meta-insights-${accountId}-${range.since}.csv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                  .catch(() => setError('Tải CSV thất bại'));
              }}
            >
              Tải CSV
            </button>
          ) : null}
        </div>
      </div>

      {syncMeta?.last_synced_at ? (
        <p className="muted portal-crm-ads-lead-report__sync">
          Đồng bộ lần cuối:{' '}
          {(() => {
            const d = new Date(syncMeta.last_synced_at);
            if (Number.isNaN(d.getTime())) return fmtDate(syncMeta.last_synced_at.slice(0, 10));
            return d.toLocaleString('vi-VN', {
              timeZone: 'Asia/Saigon',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          })()}
        </p>
      ) : null}
      {syncMeta?.last_error ? <p className="error">Lỗi đồng bộ: {syncMeta.last_error}</p> : null}
      {syncMeta?.last_breakdown_warnings ? (
        <p className="muted portal-crm-ads-lead-report__sync">
          Một số phân tích không khả dụng cho tài khoản này (không ảnh hưởng chỉ số chính).
        </p>
      ) : null}
      {rangeValidationError ? <p className="error">{rangeValidationError}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading && !insights && !error ? <p className="muted">Đang tải báo cáo…</p> : null}
      {showEmpty ? <p className="muted">Chưa gán tài khoản quảng cáo — liên hệ PTT để gán.</p> : null}

      {insights && kpi ? (
        <>
          <div className="portal-crm-ads-lead-report__kpis">
            <div className="portal-crm-ads-lead-report__kpi">
              <span className="muted">Chi tiêu</span>
              <strong>{fmtVnd(kpi.spend)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
            </div>
            <div className="portal-crm-ads-lead-report__kpi">
              <span className="muted">Hiển thị</span>
              <strong>{fmtNumber(kpi.impressions)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
            </div>
            {kpi.reach > 0 ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">Tiếp cận</span>
                <strong>{fmtNumber(kpi.reach)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
              </div>
            ) : null}
            <div className="portal-crm-ads-lead-report__kpi">
              <span className="muted">Lượt nhấp</span>
              <strong>{fmtNumber(kpi.clicks)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
            </div>
            {kpi.ctr != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted" title="Tỷ lệ nhấp — số nhấp chia cho số lần hiển thị">CTR</span>
                <strong>{fmtPct(kpi.ctr)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
              </div>
            ) : null}
            {kpi.cpc != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted" title="Chi phí trên mỗi lượt nhấp">CPC</span>
                <strong>{fmtVnd(kpi.cpc)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
              </div>
            ) : null}
            {kpi.cpm != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted" title="Chi phí trên 1.000 lần hiển thị">CPM</span>
                <strong>{fmtVnd(kpi.cpm)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
              </div>
            ) : null}
            <div className="portal-crm-ads-lead-report__kpi" data-testid="ads-leads-platform">
              <span className="muted" title={LEAD_PLATFORM_TIP}>Lead nền tảng</span>
              <strong>{fmtNumber(kpi.leads_platform)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
            </div>
            <div className="portal-crm-ads-lead-report__kpi" data-testid="ads-leads-received">
              <span className="muted" title={LEAD_RECEIVED_TIP}>{LEAD_RECEIVED_LABEL}</span>
              <strong>{fmtNumber(portalLeadTotal)}</strong>
              {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
            </div>
            {kpi.cpl != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted" title="Chi phí trên mỗi lead">CPL</span>
                <strong>{fmtVnd(kpi.cpl)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
              </div>
            ) : null}
            {kpi.purchases > 0 ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">Lượt mua</span>
                <strong>{fmtNumber(kpi.purchases)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
              </div>
            ) : null}
            {kpi.roas != null && kpi.roas > 0 ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted" title="Tỷ lệ doanh thu trên chi phí quảng cáo">ROAS</span>
                <strong>{kpi.roas.toFixed(2)}</strong>
                {rangeLabel ? <span className="muted kpi-tile__hint">{rangeLabel}</span> : null}
              </div>
            ) : null}
          </div>

          <h4 className="portal-crm-ads-lead-report__subtitle">Chi tiêu theo ngày</h4>
          {dailyRows.length === 0 ? (
            <p className="muted">Chưa có chi tiêu trong khoảng đã chọn — thử Đồng bộ ngay.</p>
          ) : (
            <>
              {dailyRows.length >= 2 && chartPoints ? (
                <svg className="portal-crm-ads-lead-report__chart" viewBox="0 0 320 84" role="img" aria-label="Biểu đồ chi tiêu">
                  <path d={chartPoints} fill="none" stroke="var(--accent, #2563eb)" strokeWidth="2" />
                </svg>
              ) : null}
              <div className="portal-crm-ads-lead-report__table-wrap">
                <table className="portal-crm-ads-lead-report__table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Chi tiêu</th>
                      <th>Lead nền tảng</th>
                      <th>{LEAD_RECEIVED_LABEL}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dailyRows].reverse().map((row) => (
                      <tr key={row.date}>
                        <td>{fmtDate(row.date)}</td>
                        <td>{fmtVnd(row.spend)}</td>
                        <td>{fmtNumber(row.leads_platform)}</td>
                        <td>{fmtNumber(row.leadsPortal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="portal-crm-ads-lead-report__tabs" role="tablist">
            {(['campaign', 'adset', 'ad', 'breakdown'] as TableTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                className={tableTab === tab ? 'active' : ''}
                onClick={() => setTableTab(tab)}
              >
                {tab === 'campaign' ? 'Chiến dịch' : tab === 'adset' ? 'Nhóm quảng cáo' : tab === 'ad' ? 'Quảng cáo' : 'Phân tích'}
              </button>
            ))}
          </div>

          {tableTab === 'breakdown' ? (
            <>
              <label className="portal-crm-ads-lead-report__page-pick">
                <span className="muted">Loại phân tích</span>
                <select value={breakdownType} onChange={(e) => setBreakdownType(e.target.value)}>
                  <option value="age">Tuổi</option>
                  <option value="gender">Giới tính</option>
                  <option value="publisher_platform">Nền tảng</option>
                  <option value="platform_position">Vị trí</option>
                  <option value="region">Khu vực</option>
                </select>
              </label>
              {breakdownRows.length === 0 ? (
                <p className="muted">Chưa có phân tích — đồng bộ lại hoặc loại này chưa được nền tảng hỗ trợ.</p>
              ) : (
                <div className="portal-crm-ads-lead-report__table-wrap">
                  <table className="portal-crm-ads-lead-report__table">
                    <thead>
                      <tr>
                        <th>Giá trị</th>
                        <th>Chi tiêu</th>
                        <th>Hiển thị</th>
                        <th>Lượt nhấp</th>
                        <th>Lead nền tảng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownRows.map((row) => (
                        <tr key={row.value}>
                          <td>{row.value}</td>
                          <td>{fmtVnd(row.spend)}</td>
                          <td>{fmtNumber(row.impressions)}</td>
                          <td>{fmtNumber(row.clicks)}</td>
                          <td>{fmtNumber(row.leads_platform)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : tableRows.length === 0 ? (
            <p className="muted">Chưa có dữ liệu ở mức {tableTab === 'campaign' ? 'chiến dịch' : tableTab === 'adset' ? 'nhóm quảng cáo' : 'quảng cáo'}.</p>
          ) : (
            <div className="portal-crm-ads-lead-report__table-wrap">
              <table className="portal-crm-ads-lead-report__table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Mã</th>
                    <th>Chi tiêu</th>
                    <th>Hiển thị</th>
                    <th>Lượt nhấp</th>
                    <th title="Tỷ lệ nhấp — số nhấp chia cho số lần hiển thị">CTR</th>
                    <th>Lead nền tảng</th>
                    <th>{LEAD_RECEIVED_LABEL}</th>
                    <th title="Chi phí trên mỗi lead">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {(tableRows as Array<Record<string, unknown>>).map((row) => {
                    const id = String(row.id ?? '');
                    const leadsPortal = leadsByCampaign.get(id) ?? 0;
                    return (
                      <tr key={id}>
                        <td>{String(row.name ?? '—')}</td>
                        <td className="muted">{id || '—'}</td>
                        <td>{fmtVnd(Number(row.spend ?? 0))}</td>
                        <td>{fmtNumber(Number(row.impressions ?? 0))}</td>
                        <td>{fmtNumber(Number(row.clicks ?? 0))}</td>
                        <td>{row.ctr != null ? fmtPct(Number(row.ctr)) : '—'}</td>
                        <td>{fmtNumber(Number(row.leads_platform ?? 0))}</td>
                        <td>{tableTab === 'campaign' ? fmtNumber(leadsPortal) : '—'}</td>
                        <td>{row.cpl != null ? fmtVnd(Number(row.cpl)) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
