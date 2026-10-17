'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { ApiError, staffMe, staffRefresh } from '@/lib/api';
import { fetchAePerformance, type AePerformanceBoard } from '@/lib/crm/ae-team-api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import '../ae-team.css';

function count(value: number): string {
  return value ? String(value) : '—';
}

export default function AePerformancePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<AePerformanceBoard | null>(null);
  const [error, setError] = useState('');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const load = useCallback(async (access: string, project = '') => {
    setData(await fetchAePerformance(access, project || undefined));
    setError('');
  }, []);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setToken(access);
    staffMe(access)
      .then(async (me) => {
        setUser(me);
        updateStoredUser(me);
        await load(access, '');
      })
      .catch(async (err: unknown) => {
        const refresh = getRefreshToken();
        if (!(err instanceof ApiError) || err.status !== 401 || !refresh) {
          setError(err instanceof ApiError ? err.message : 'Không tải được hiệu suất AE');
          return;
        }
        try {
          const out = await staffRefresh(refresh);
          updateAccessToken(out.access_token);
          setToken(out.access_token);
          const me = await staffMe(out.access_token);
          setUser(me);
          updateStoredUser(me);
          await load(out.access_token, '');
        } catch {
          clearSession();
          router.replace('/login');
        }
      });
  }, [load, router]);

  return (
    <StaffPageShell user={user} onLogout={logout} width="full" breadcrumb={[{ label: 'Hiệu suất AE' }]}>
      <div className="ae-team">
        <PageToolbar
          title="Hiệu suất theo Owner"
          subtitle={data?.note || 'Lead được phân công cho AE. Lọc dự án để xem từng dự án.'}
        />
        <div className="ae-team-bar">
          <label>
            Dự án{' '}
            <select
              value={projectId}
              onChange={(event) => {
                const next = event.target.value;
                setProjectId(next);
                if (token) {
                  load(token, next).catch((err: unknown) => {
                    setError(err instanceof ApiError ? err.message : 'Không tải được hiệu suất AE');
                  });
                }
              }}
            >
              <option value="">Mọi dự án</option>
              {(data?.projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.code}</option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="ae-team-error">{error}</p> : null}
        {data ? (
          <>
            <div className="ae-perf-kpis">
              <div className="ae-perf-kpi"><span>Tổng lead</span><strong>{data.totals.total}</strong></div>
              <div className="ae-perf-kpi is-wait"><span>Chờ gắn dự án</span><strong>{data.totals.unassigned}</strong></div>
              <div className="ae-perf-kpi is-hot"><span>Hot</span><strong>{data.totals.hot}</strong></div>
              <div className="ae-perf-kpi is-sla"><span>Quá SLA</span><strong>{data.totals.sla_breach}</strong></div>
              <div className="ae-perf-kpi"><span>Chuyển đổi</span><strong>{data.totals.conversion_pct}%</strong></div>
              <div className="ae-perf-kpi"><span>Chốt</span><strong>{data.totals.won}</strong></div>
            </div>
            <section className="ae-team-panel">
              <div className="ae-team-panel-head">
                <div>
                  <strong>Hiệu suất theo Owner</strong>
                  <p>Cột trạng thái là bước trên bảng lead. Đang mở là lead chưa chốt và chưa mất.</p>
                </div>
              </div>
              <div className="ae-perf-scroll">
                <table className="ae-perf-table">
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>Tổng</th>
                      <th>Theo dự án</th>
                      {data.stages.map((stage) => <th key={stage.id}>{stage.label}</th>)}
                      <th>Đang mở</th>
                      <th>Mất</th>
                      <th>Chốt</th>
                      <th>%</th>
                      <th>Quá SLA</th>
                      <th>Điểm TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 ? (
                      <tr><td colSpan={10 + data.stages.length}>Chưa có AE trong phạm vi này.</td></tr>
                    ) : null}
                    {data.rows.map((row) => (
                      <tr key={row.staff_id}>
                        <td>
                          <span className="ae-perf-owner">{row.name}</span>
                          {row.code ? <span className="ae-perf-code"> ({row.code})</span> : null}
                        </td>
                        <td>{row.total}</td>
                        <td>
                          {row.projects.length
                            ? row.projects.map((project) => (
                              <span key={project.code} className="ae-perf-pill">{project.code}: {project.count}</span>
                            ))
                            : '—'}
                        </td>
                        {data.stages.map((stage) => (
                          <td key={stage.id} className={row.stages[stage.id] ? undefined : 'ae-perf-zero'}>
                            {count(row.stages[stage.id])}
                          </td>
                        ))}
                        <td>{row.open}</td>
                        <td className={row.lost ? undefined : 'ae-perf-zero'}>{count(row.lost)}</td>
                        <td>{row.won}</td>
                        <td>{row.conversion_pct}%</td>
                        <td className={row.sla_breach ? 'ae-perf-sla' : 'ae-perf-zero'}>{row.sla_breach}</td>
                        <td>{row.avg_score == null ? '—' : row.avg_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </StaffPageShell>
  );
}
