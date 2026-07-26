'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import {
  KpiAlertList,
  KpiBarChart,
  KpiTileGrid,
  type KpiTileProps,
} from '@/components/kpi/KpiDashboardUi';
import { periodLabel } from '@/lib/kpi/format';
import {
  exportStaffKpi,
  fetchKpiBoard,
  fetchKpiChart,
  fetchKpiMetrics,
  staffMe,
  staffRefresh,
  type KpiChartData,
  type KpiMetricRow,
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

export default function CrmKpiPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [metrics, setMetrics] = useState<KpiMetricRow[]>([]);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof fetchKpiBoard>> | null>(null);
  const [chartMetricId, setChartMetricId] = useState('');
  const [chartData, setChartData] = useState<KpiChartData | null>(null);
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
      if (!hasCap(me, 'crm_kpi_records', 'view')) {
        setError('Không có quyền KPI');
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

  const loadPage = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const [metricRows, boardOut] = await Promise.all([
          fetchKpiMetrics(access),
          fetchKpiBoard(access, { year, month }),
        ]);
        setMetrics(metricRows);
        setBoard(boardOut);
        const nextMetricId = chartMetricId || (metricRows[0] ? String(metricRows[0].id) : '');
        if (!chartMetricId && metricRows[0]) {
          setChartMetricId(String(metricRows[0].id));
        }
        if (nextMetricId) {
          const chart = await fetchKpiChart(access, {
            metric_id: Number(nextMetricId),
            year,
            month,
          });
          setChartData(chart);
        } else {
          setChartData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải KPI thất bại');
      } finally {
        setLoading(false);
      }
    },
    [year, month],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadPage(access);
    })();
  }, [ensureAuth, loadPage]);

  async function reloadChart(nextMetricId = chartMetricId) {
    const access = getAccessToken();
    if (!access || !nextMetricId) return;
    setError('');
    try {
      setChartData(
        await fetchKpiChart(access, {
          metric_id: Number(nextMetricId),
          year,
          month,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải biểu đồ thất bại');
    }
  }

  async function onExport() {
    const access = getAccessToken();
    if (!access) return;
    setError('');
    try {
      const bundle = await exportStaffKpi(access, { year, month });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staff-kpi-export-${year}-${String(month).padStart(2, '0')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export thất bại');
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const tiles = useMemo((): KpiTileProps[] => {
    const summary = board?.summary ?? { critical: 0, warn: 0 };
    return [
      {
        label: 'Nhân viên có KPI',
        value: String(board?.staff_count ?? 0),
        hint: periodLabel(year, month),
      },
      {
        label: 'Chỉ tiêu ghi nhận',
        value: String(board?.kpi_count ?? 0),
        hint: `${metrics.length} metric định nghĩa`,
      },
      {
        label: 'Cảnh báo nghiêm trọng',
        value: String(summary.critical ?? 0),
        tone: (summary.critical ?? 0) > 0 ? 'critical' : 'success',
      },
      {
        label: 'Cảnh báo vàng',
        value: String(summary.warn ?? 0),
        tone: (summary.warn ?? 0) > 0 ? 'warning' : 'default',
      },
    ];
  }, [board, metrics.length, year, month]);

  const chartItems = useMemo(() => {
    if (!chartData) return [];
    const staffIds = chartData.staff_ids ?? [];
    return (chartData.labels ?? []).map((label, index) => ({
      label,
      value: chartData.achievement_pct?.[index] ?? null,
      href: staffIds[index] ? `/crm/staff/${staffIds[index]}` : undefined,
    }));
  }, [chartData]);

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
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Chỉ tiêu KPI</h2>
          <div className="kpi-page__filters">
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Năm"
              className="kpi-input"
            />
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              aria-label="Tháng"
              className="kpi-input kpi-input--month"
            />
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onExport()}>
              Export staff KPI (JSON)
            </button>
          </div>
        </div>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <KpiTileGrid tiles={tiles} />

        <section className="kpi-page__section">
          <h3 className="kpi-section-title">Cảnh báo tháng</h3>
          <KpiAlertList alerts={board?.alerts ?? []} />
        </section>

        <section className="kpi-page__section">
          <div className="kpi-page__chart-head">
            <h3 className="kpi-section-title">So sánh NV theo chỉ tiêu</h3>
            <div className="kpi-page__filters">
              <select
                value={chartMetricId}
                onChange={(e) => {
                  setChartMetricId(e.target.value);
                  void reloadChart(e.target.value);
                }}
                className="kpi-select"
                aria-label="Chỉ tiêu biểu đồ"
              >
                {metrics.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" onClick={() => void reloadChart()}>
                Làm mới
              </button>
            </div>
          </div>
          <KpiBarChart
            title={String(chartData?.metric?.name ?? 'Đạt KPI (%)')}
            items={chartItems}
            unit="%"
            maxValue={100}
          />
        </section>

        <details className="kpi-page__metrics-details">
          <summary className="muted">Danh sách metric định nghĩa ({metrics.length})</summary>
          <ul className="kpi-metric-list">
            {metrics.map((m) => (
              <li key={m.id}>
                {m.code ? `[${m.code}] ` : ''}
                {m.name}
                {m.unit ? ` (${m.unit})` : ''}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </main>
  );
}
