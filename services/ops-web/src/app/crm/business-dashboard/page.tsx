'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import {
  KpiAlertList,
  KpiTileGrid,
  KpiTrendPanel,
  businessDashboardTiles,
  extractTrendSeries,
} from '@/components/kpi/KpiDashboardUi';
import { formatPct, formatVnd, periodLabel } from '@/lib/kpi/format';
import {
  fetchFinanceBusinessDashboard,
  fetchFinanceKpiAlerts,
  fetchFinanceKpiTrends,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function CrmBusinessDashboardPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [trendMonths, setTrendMonths] = useState(6);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [trends, setTrends] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_business_dashboard', 'view')) {
        setError('Không có quyền Business Dashboard');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const loadData = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const [dash, alertOut, trendOut] = await Promise.all([
          fetchFinanceBusinessDashboard(access, { year, month, trend_months: trendMonths }),
          fetchFinanceKpiAlerts(access, { year, month }),
          fetchFinanceKpiTrends(access, { year, month, trend_months: trendMonths }),
        ]);
        setDashboard(dash);
        const alertList = (alertOut.alerts ?? dash.kpi_alerts ?? []) as Array<Record<string, unknown>>;
        setAlerts(alertList);
        setTrends((trendOut.trends as Record<string, unknown> | undefined) ?? trendOut);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dashboard thất bại');
      } finally {
        setLoading(false);
      }
    },
    [year, month, trendMonths],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadData(access);
    })();
  }, [ensureAuth, loadData]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const trendSeries = useMemo(() => extractTrendSeries(trends), [trends]);
  const tiles = useMemo(() => businessDashboardTiles(dashboard, alerts.length), [dashboard, alerts.length]);

  const leadKpi = (dashboard?.lead_kpi ?? {}) as Record<string, unknown>;
  const delivery = ((dashboard?.exec_metrics as Record<string, unknown> | undefined)?.delivery_ontime ??
    {}) as Record<string, unknown>;

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <main className="kpi-page" style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={logout} />
      <div className="card">
        <div className="kpi-page__head">
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Business Dashboard</h2>
          <div className="kpi-page__filters">
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="kpi-input" aria-label="Năm" />
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="kpi-input kpi-input--month"
              aria-label="Tháng"
            />
            <input
              type="number"
              min={3}
              max={12}
              value={trendMonths}
              onChange={(e) => setTrendMonths(Number(e.target.value))}
              className="kpi-input kpi-input--month"
              aria-label="Số tháng xu hướng"
              title="Số tháng xu hướng"
            />
          </div>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          Kỳ {periodLabel(year, month)} · xu hướng {trendMonths} tháng
        </p>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <KpiTileGrid tiles={tiles} />

        <section className="kpi-page__section">
          <h3 className="kpi-section-title">Xu hướng executive</h3>
          <div className="kpi-trend-grid">
            <KpiTrendPanel title="MRR bookings" labels={trendSeries.labels} series={trendSeries.mrr} valueFormatter={formatVnd} />
            <KpiTrendPanel
              title="Top-2 concentration"
              labels={trendSeries.labels}
              series={trendSeries.concentration}
              valueFormatter={(v) => formatPct(v)}
            />
            <KpiTrendPanel title="CAC" labels={trendSeries.labels} series={trendSeries.cac} valueFormatter={formatVnd} />
          </div>
        </section>

        <section className="kpi-page__section kpi-page__section--split">
          <div>
            <h3 className="kpi-section-title">Lead & delivery</h3>
            <ul className="kpi-kv-list">
              <li>
                <span>Close rate cohort</span>
                <strong>{formatPct(leadKpi.cohort_close_rate_pct)}</strong>
              </li>
              <li>
                <span>Delivery on-time</span>
                <strong>{formatPct(delivery.on_time_rate_pct)}</strong>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="kpi-section-title">Drill-down nhanh</h3>
            <ul className="kpi-kv-list">
              <li>
                <a href="/crm/hub" className="nav-link">
                  Hub hợp đồng →
                </a>
              </li>
              <li>
                <a href="/crm/financials" className="nav-link">
                  Tài chính / AR →
                </a>
              </li>
              <li>
                <a href="/crm/kpi" className="nav-link">
                  KPI nhân viên →
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section className="kpi-page__section">
          <h3 className="kpi-section-title">Cảnh báo KPI ({alerts.length})</h3>
          <KpiAlertList alerts={alerts} />
        </section>
      </div>
    </main>
  );
}
