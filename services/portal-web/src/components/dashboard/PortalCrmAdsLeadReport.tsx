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
  const name = page.page_name?.trim() || page.page_id;
  return `${name} · act_${page.page_id}`;
}

type TableTab = 'campaign' | 'adset' | 'ad' | 'breakdown';

type PortalCrmAdsLeadReportProps = {
  token: string;
  embedded?: boolean;
  accountId?: string;
  onAccountIdChange?: (id: string) => void;
  adAccounts?: PortalCrmPage[];
  adAccountsLoaded?: boolean;
  canSync?: boolean;
};

export function PortalCrmAdsLeadReport({
  token,
  embedded = false,
  accountId: controlledAccountId,
  onAccountIdChange,
  adAccounts: controlledAccounts,
  adAccountsLoaded = false,
  canSync = false,
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
    if (rangePreset === 'custom') {
      return { since: customSince, until: customUntil };
    }
    return rangeEndingToday(rangePreset);
  }, [rangePreset, customSince, customUntil]);

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

  const leadsByDay = useMemo(() => countLeadsByDay(insights?.leads ?? []), [insights]);
  const leadsByCampaign = useMemo(() => countLeadsByCampaignId(insights?.leads ?? []), [insights]);

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

  const portalLeadTotal = insights?.leads.length ?? 0;
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
            Tài khoản quảng cáo · KPI, spend theo ngày, chiến dịch / ad set / ad · lead portal theo campaign_id
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
          {canSync && accountId && accountId !== ALL_ACCOUNTS_VALUE ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={syncing || loading} onClick={() => void onSync()}>
              {syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
            </button>
          ) : null}
          {accountId && accountId !== ALL_ACCOUNTS_VALUE ? (
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
                  .catch(() => setError('Export CSV thất bại'));
              }}
            >
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      {syncMeta?.last_synced_at ? (
        <p className="muted portal-crm-ads-lead-report__sync">
          Đồng bộ lần cuối: {fmtDate(syncMeta.last_synced_at.slice(0, 10))}
          {syncMeta.last_synced_at.length > 10 ? ` ${syncMeta.last_synced_at.slice(11, 19)}` : ''}
        </p>
      ) : null}
      {syncMeta?.last_error ? <p className="error">Lỗi đồng bộ: {syncMeta.last_error}</p> : null}
      {syncMeta?.last_breakdown_warnings ? (
        <p className="muted portal-crm-ads-lead-report__sync">
          Một số breakdown không được Graph hỗ trợ cho tài khoản này (không ảnh hưởng KPI chính).
        </p>
      ) : null}
      {rangeValidationError ? <p className="error">{rangeValidationError}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải workspace CRM…</p> : null}
      {showEmpty ? <p className="muted">Chưa gán tài khoản quảng cáo — liên hệ PTT để gán.</p> : null}

      {!loading && insights && kpi ? (
        <>
          <div className="portal-crm-ads-lead-report__kpis">
            <div className="portal-crm-ads-lead-report__kpi">
              <span className="muted">Spend</span>
              <strong>{fmtVnd(kpi.spend)}</strong>
            </div>
            <div className="portal-crm-ads-lead-report__kpi">
              <span className="muted">Impressions</span>
              <strong>{fmtNumber(kpi.impressions)}</strong>
            </div>
            {kpi.reach > 0 ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">Reach</span>
                <strong>{fmtNumber(kpi.reach)}</strong>
              </div>
            ) : null}
            <div className="portal-crm-ads-lead-report__kpi">
              <span className="muted">Clicks</span>
              <strong>{fmtNumber(kpi.clicks)}</strong>
            </div>
            {kpi.ctr != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">CTR</span>
                <strong>{fmtPct(kpi.ctr)}</strong>
              </div>
            ) : null}
            {kpi.cpc != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">CPC</span>
                <strong>{fmtVnd(kpi.cpc)}</strong>
              </div>
            ) : null}
            {kpi.cpm != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">CPM</span>
                <strong>{fmtVnd(kpi.cpm)}</strong>
              </div>
            ) : null}
            <div className="portal-crm-ads-lead-report__kpi">
              <span className="muted">Lead nền tảng</span>
              <strong>{fmtNumber(kpi.leads_platform)}</strong>
            </div>
            {portalLeadTotal > 0 ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">Lead portal</span>
                <strong>{fmtNumber(portalLeadTotal)}</strong>
              </div>
            ) : null}
            {kpi.cpl != null ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">CPL</span>
                <strong>{fmtVnd(kpi.cpl)}</strong>
              </div>
            ) : null}
            {kpi.purchases > 0 ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">Purchases</span>
                <strong>{fmtNumber(kpi.purchases)}</strong>
              </div>
            ) : null}
            {kpi.roas != null && kpi.roas > 0 ? (
              <div className="portal-crm-ads-lead-report__kpi">
                <span className="muted">ROAS</span>
                <strong>{kpi.roas.toFixed(2)}</strong>
              </div>
            ) : null}
          </div>

          <h4 className="portal-crm-ads-lead-report__subtitle">Spend theo ngày</h4>
          {dailyRows.length === 0 ? (
            <p className="muted">Chưa có spend trong khoảng đã chọn — thử Đồng bộ ngay.</p>
          ) : (
            <>
              <svg className="portal-crm-ads-lead-report__chart" viewBox="0 0 320 84" role="img" aria-label="Biểu đồ spend">
                <path d={chartPoints} fill="none" stroke="var(--accent, #2563eb)" strokeWidth="2" />
              </svg>
              <div className="portal-crm-ads-lead-report__table-wrap">
                <table className="portal-crm-ads-lead-report__table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Spend</th>
                      <th>Lead nền tảng</th>
                      <th>Lead portal</th>
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
                {tab === 'campaign' ? 'Chiến dịch' : tab === 'adset' ? 'Ad set' : tab === 'ad' ? 'Ad' : 'Breakdown'}
              </button>
            ))}
          </div>

          {tableTab === 'breakdown' ? (
            <>
              <label className="portal-crm-ads-lead-report__page-pick">
                <span className="muted">Loại breakdown</span>
                <select value={breakdownType} onChange={(e) => setBreakdownType(e.target.value)}>
                  <option value="age">age</option>
                  <option value="gender">gender</option>
                  <option value="publisher_platform">publisher_platform</option>
                  <option value="platform_position">platform_position</option>
                  <option value="region">region</option>
                </select>
              </label>
              {breakdownRows.length === 0 ? (
                <p className="muted">Chưa có breakdown — đồng bộ lại hoặc loại này chưa được Graph hỗ trợ.</p>
              ) : (
                <div className="portal-crm-ads-lead-report__table-wrap">
                  <table className="portal-crm-ads-lead-report__table">
                    <thead>
                      <tr>
                        <th>Giá trị</th>
                        <th>Spend</th>
                        <th>Impressions</th>
                        <th>Clicks</th>
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
            <p className="muted">Chưa có dữ liệu ở mức {tableTab}.</p>
          ) : (
            <div className="portal-crm-ads-lead-report__table-wrap">
              <table className="portal-crm-ads-lead-report__table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>ID</th>
                    <th>Spend</th>
                    <th>Impressions</th>
                    <th>Clicks</th>
                    <th>CTR</th>
                    <th>Lead nền tảng</th>
                    <th>Lead portal</th>
                    <th>CPL</th>
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
