'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpsNav } from '@/components/OpsNav';
import {
  ArAgingPanel,
  KpiTileGrid,
  financialSummaryTiles,
} from '@/components/kpi/KpiDashboardUi';
import { periodLabel } from '@/lib/kpi/format';
import {
  fetchFinanceArAging,
  fetchFinanceFinancials,
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

export default function CrmFinancialsPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [financials, setFinancials] = useState<Record<string, unknown> | null>(null);
  const [arAging, setArAging] = useState<Record<string, unknown> | null>(null);
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
        setError('Không có quyền Financials');
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
        const [fin, ar] = await Promise.all([
          fetchFinanceFinancials(access, { year, month }),
          fetchFinanceArAging(access),
        ]);
        setFinancials(fin);
        setArAging(ar.buckets ? ar : (fin.ar_aging as Record<string, unknown>) ?? ar);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải financials thất bại');
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
      await loadData(access);
    })();
  }, [ensureAuth, loadData]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const summaryTiles = useMemo(() => financialSummaryTiles(financials), [financials]);
  const rows = (financials?.rows ?? []) as Array<Record<string, unknown>>;

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
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Financials — lifecycle margin</h2>
          <div className="kpi-page__filters">
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="kpi-input"
              aria-label="Năm"
            />
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="kpi-input kpi-input--month"
              aria-label="Tháng"
            />
          </div>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          Kỳ {periodLabel(year, month)}
        </p>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <KpiTileGrid tiles={summaryTiles} />

        <section className="kpi-page__section">
          <h3 className="kpi-section-title">Lifecycle ({rows.length})</h3>
          <div className="crm-leads-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Dịch vụ</th>
                  <th>KH</th>
                  <th style={{ textAlign: 'right' }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Chưa có lifecycle active
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={String(row.lifecycle_id ?? i)}>
                      <td>{String(row.lifecycle_id ?? '—')}</td>
                      <td>{String(row.service_label ?? row.service_slug ?? '—')}</td>
                      <td>{String(row.customer_name ?? '—')}</td>
                      <td style={{ textAlign: 'right' }}>
                        {row.margin_pct != null
                          ? `${Number(row.margin_pct).toFixed(1)}%`
                          : row.margin_vnd != null
                            ? `${Number(row.margin_vnd).toLocaleString('vi-VN')} ₫`
                            : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="kpi-page__section">
          <h3 className="kpi-section-title">AR aging</h3>
          <ArAgingPanel arAging={arAging} />
        </section>
      </div>
    </main>
  );
}
