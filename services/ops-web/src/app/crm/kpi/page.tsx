'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { KpiAttentionTable } from '@/components/kpi/KpiAttentionTable';
import { KpiCockpitInsight } from '@/components/kpi/KpiCockpitInsight';
import { KpiCockpitList } from '@/components/kpi/KpiCockpitList';
import { KpiCockpitTiles } from '@/components/kpi/KpiCockpitTiles';
import { KpiCreateMetricDrawer } from '@/components/kpi/KpiCreateMetricDrawer';
import { KpiDeptStackChart } from '@/components/kpi/KpiDeptStackChart';
import { KpiEditableGrid } from '@/components/kpi/KpiEditableGrid';
import { KpiRagDonut } from '@/components/kpi/KpiRagDonut';
import { KpiTeamToggle, type KpiTeamOption } from '@/components/kpi/KpiTeamToggle';
import { KpiBarChart, KpiTrendPanel } from '@/components/kpi/KpiDashboardUi';
import {
  buildCockpitSummary,
  departmentOptions,
  filterRowsByDepartment,
  prevYearMonth,
} from '@/lib/kpi/cockpit-summary';
import { formatPct, periodLabel } from '@/lib/kpi/format';
import {
  downloadStaffKpiXlsx,
  fetchKpiChart,
  fetchKpiMetricTrend,
  fetchKpiMetrics,
  fetchStaffKpi,
  patchStaffKpiProgress,
  staffMe,
  staffRefresh,
  type KpiChartData,
  type KpiMetricRow,
  type StaffKpiGridEntry,
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
  const [team, setTeam] = useState<KpiTeamOption>('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [metrics, setMetrics] = useState<KpiMetricRow[]>([]);
  const [chartMetricId, setChartMetricId] = useState('');
  const [chartData, setChartData] = useState<KpiChartData | null>(null);
  const [trendLabels, setTrendLabels] = useState<string[]>([]);
  const [trendSeries, setTrendSeries] = useState<number[]>([]);
  const [gridRows, setGridRows] = useState<StaffKpiGridEntry[]>([]);
  const [prevRows, setPrevRows] = useState<StaffKpiGridEntry[]>([]);
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

  const loadTrend = useCallback(async (access: string, metricId: string) => {
    if (!metricId) {
      setTrendLabels([]);
      setTrendSeries([]);
      return;
    }
    try {
      const trend = await fetchKpiMetricTrend(access, {
        metric_id: Number(metricId),
        year,
        month,
        months: 6,
      });
      setTrendLabels(trend.labels ?? []);
      setTrendSeries(trend.avg_achievement_pct ?? []);
    } catch {
      setTrendLabels([]);
      setTrendSeries([]);
    }
  }, [year, month]);

  const loadPage = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const prev = prevYearMonth(year, month);
        const teamParam = team === 'all' ? undefined : team;
        const [metricRows, staffKpiRows, prevKpiRows] = await Promise.all([
          fetchKpiMetrics(access),
          fetchStaffKpi(access, { year, month, team: teamParam }).catch(() => []),
          fetchStaffKpi(access, { year: prev.year, month: prev.month, team: teamParam }).catch(() => []),
        ]);
        setMetrics(metricRows);
        setGridRows(staffKpiRows);
        setPrevRows(prevKpiRows);
        const nextMetricId = chartMetricId || (metricRows[0] ? String(metricRows[0].id) : '');
        if (!chartMetricId && metricRows[0]) {
          setChartMetricId(String(metricRows[0].id));
        }
        if (nextMetricId) {
          const chart = await fetchKpiChart(access, {
            metric_id: Number(nextMetricId),
            year,
            month,
            team: teamParam,
          });
          setChartData(chart);
          await loadTrend(access, nextMetricId);
        } else {
          setChartData(null);
          setTrendLabels([]);
          setTrendSeries([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải KPI thất bại');
      } finally {
        setLoading(false);
      }
    },
    [year, month, chartMetricId, loadTrend, team],
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
          team: team === 'all' ? undefined : team,
        }),
      );
      await loadTrend(access, nextMetricId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải biểu đồ thất bại');
    }
  }

  async function onExportExcel() {
    const access = getAccessToken();
    if (!access) return;
    setError('');
    try {
      await downloadStaffKpiXlsx(access, { year, month });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export Excel thất bại');
    }
  }

  async function onGridSaved() {
    const access = getAccessToken();
    if (!access) return;
    await loadPage(access);
  }

  async function onPatchGridActual(kpiId: number, actual: number | null) {
    const access = getAccessToken();
    if (!access) throw new Error('Phiên đăng nhập hết hạn');
    await patchStaffKpiProgress(access, kpiId, { actual_value: actual });
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const canEditKpi = hasCap(user, 'crm_kpi_records', 'edit');
  const token = getAccessToken() ?? '';

  const filtered = useMemo(
    () => filterRowsByDepartment(gridRows, deptFilter),
    [gridRows, deptFilter],
  );
  const filteredPrev = useMemo(
    () => filterRowsByDepartment(prevRows, deptFilter),
    [prevRows, deptFilter],
  );
  const summary = useMemo(
    () => buildCockpitSummary(filtered, filteredPrev, new Date()),
    [filtered, filteredPrev],
  );

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
    <DashboardShell
      user={user}
      onLogout={logout}
      title="Quản lý KPI"
      periodHint={`Theo dõi mục tiêu, kết quả và cảnh báo hiệu suất · Kỳ ${periodLabel(year, month)}`}
      loading={loading}
      error={error}
      filters={
        <>
          <KpiTeamToggle value={team} onChange={setTeam} />
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
          <select
            className="kpi-select"
            aria-label="Phòng ban"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">Tất cả phòng ban</option>
            {departmentOptions(gridRows).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onExportExcel()}>
            Xuất báo cáo
          </button>
          {canEditKpi ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setCreateOpen(true)}>
              + Tạo KPI
            </button>
          ) : null}
        </>
      }
    >
      <div className="kpi-cockpit">
        <KpiCockpitTiles summary={summary} />
        <section className="kpi-page__section kpi-page__section--split">
          <KpiDeptStackChart rows={summary.by_department} />
          <KpiAttentionTable rows={summary.attention} />
        </section>
        <section className="kpi-page__section kpi-cockpit__split">
          <KpiCockpitList
            rows={filtered}
            prevRows={filteredPrev}
            userStaffId={Number.isFinite(Number(user.id)) ? Number(user.id) : null}
          />
          <div>
            <KpiCockpitInsight insight={summary.insight} />
            <KpiRagDonut green={summary.green} yellow={summary.yellow} red={summary.red} />
          </div>
        </section>
        <section className="kpi-page__section">
          <h3 className="kpi-section-title">Nhập actual KPI</h3>
          <KpiEditableGrid
            rows={gridRows}
            canEdit={canEditKpi}
            onPatch={onPatchGridActual}
            onSaved={onGridSaved}
          />
        </section>
        <details className="kpi-page__metrics-details">
          <summary>So sánh NV theo chỉ tiêu</summary>
          <div className="kpi-page__chart-head">
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
          <KpiTrendPanel
            title="TB đạt KPI (6 tháng)"
            labels={trendLabels}
            series={trendSeries}
            valueFormatter={(v) => formatPct(v)}
          />
        </details>
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
      <KpiCreateMetricDrawer
        open={createOpen}
        token={token}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void onGridSaved()}
      />
    </DashboardShell>
  );
}
