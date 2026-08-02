'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { KpiBarChart, KpiProgressList } from '@/components/kpi/KpiDashboardUi';
import { periodLabel } from '@/lib/kpi/format';
import {
  fetchCrmStaffList,
  fetchKpiChart,
  fetchKpiMetrics,
  fetchStaffKpiAutoMetrics,
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

type StaffMetric = { key: string; label: string; value: number; target?: number | null };

export default function CrmStaffKpiPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [staffId, setStaffId] = useState('');
  const [role, setRole] = useState('am');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [metrics, setMetrics] = useState<StaffMetric[]>([]);
  const [metricDefs, setMetricDefs] = useState<KpiMetricRow[]>([]);
  const [compareMetricId, setCompareMetricId] = useState('');
  const [compareChart, setCompareChart] = useState<KpiChartData | null>(null);
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
      if (!hasCap(me, 'crm_staff_kpi_am_sp', 'view')) {
        setError('Không có quyền KPI AM/SP');
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

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      try {
        const [staffOut, metricRows] = await Promise.all([fetchCrmStaffList(access), fetchKpiMetrics(access)]);
        const opts = (staffOut.staff ?? []).map((s) => ({ id: s.id, name: s.name }));
        setStaffOptions(opts);
        setMetricDefs(metricRows);
        if (opts[0]) setStaffId(String(opts[0].id));
        if (metricRows[0]) setCompareMetricId(String(metricRows[0].id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  const loadMetrics = useCallback(async () => {
    const access = getAccessToken();
    if (!access || !staffId) return;
    setLoading(true);
    setError('');
    try {
      const out = await fetchStaffKpiAutoMetrics(access, Number(staffId), { role, year, month });
      setMetrics((out.metrics as StaffMetric[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải metrics thất bại');
    } finally {
      setLoading(false);
    }
  }, [staffId, role, year, month]);

  const loadCompareChart = useCallback(async () => {
    const access = getAccessToken();
    if (!access || !compareMetricId) return;
    try {
      setCompareChart(
        await fetchKpiChart(access, {
          metric_id: Number(compareMetricId),
          year,
          month,
        }),
      );
    } catch {
      setCompareChart(null);
    }
  }, [compareMetricId, year, month]);

  useEffect(() => {
    if (staffId) void loadMetrics();
  }, [staffId, role, year, month, loadMetrics]);

  useEffect(() => {
    if (compareMetricId) void loadCompareChart();
  }, [compareMetricId, year, month, loadCompareChart]);

  const compareItems = useMemo(() => {
    if (!compareChart) return [];
    const staffIds = compareChart.staff_ids ?? [];
    return (compareChart.labels ?? []).map((label, index) => ({
      label,
      value: compareChart.achievement_pct?.[index] ?? null,
      href: staffIds[index] ? `/crm/staff/${staffIds[index]}` : undefined,
    }));
  }, [compareChart]);

  function logout() {
    clearSession();
    router.push('/login');
  }

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
      title="KPI AM / SP"
      periodHint={`Kỳ ${periodLabel(year, month)}`}
      loading={loading}
      error={error || undefined}
      filters={
        <>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="kpi-select" aria-label="Nhân viên">
            {staffOptions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="kpi-select" aria-label="Vai trò">
            <option value="am">AM</option>
            <option value="sp">SP</option>
          </select>
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
        </>
      }
    >
      <section className="kpi-page__section">
        <h3 className="kpi-section-title">Tiến độ vs target</h3>
        <KpiProgressList items={metrics} staffHref={staffId ? `/crm/staff/${staffId}` : undefined} />
      </section>

      <section className="kpi-page__section">
        <div className="kpi-page__chart-head">
          <h3 className="kpi-section-title">So sánh NV cùng role</h3>
          <select
            value={compareMetricId}
            onChange={(e) => setCompareMetricId(e.target.value)}
            className="kpi-select"
            aria-label="Chỉ tiêu so sánh"
          >
            {metricDefs.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <KpiBarChart
          title={String(compareChart?.metric?.name ?? 'Đạt KPI (%)')}
          items={compareItems}
          unit="%"
          maxValue={100}
        />
      </section>
    </DashboardShell>
  );
}
