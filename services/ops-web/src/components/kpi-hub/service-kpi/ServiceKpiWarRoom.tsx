'use client';

import Link from 'next/link';
import type { ServiceKpiWarRoomData } from '@/lib/service-kpi-types';

type Props = {
  data: ServiceKpiWarRoomData;
  loading?: boolean;
  error?: string | null;
};

export function ServiceKpiWarRoom({ data, loading, error }: Props) {
  if (loading) return <p className="kpi-hub-muted">Đang tải War Room…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;

  return (
    <div className="kpi-hub-skpi-warroom">
      <div className="kpi-hub-skpi-summary">
        <span>{data.critical_overdue} at-risk</span>
        <span>{data.assumptions_open} assumption mở</span>
        <span>{data.blocked_reports} report bị chặn</span>
        <span>{data.quotes_score_gte_70} quote score ≥ 70</span>
      </div>
      <section className="kpi-hub-skpi-queue">
        <h2 className="kpi-hub-section-title">Operating queue</h2>
        {data.queue.length ? (
          <ul className="kpi-hub-skpi-queue-list">
            {data.queue.map((item) => (
              <li key={`${item.href}-${item.title}`}>
                <Link href={item.href} className="kpi-hub-skpi-queue-item">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                  <span className="kpi-hub-badge kpi-hub-badge--amber">{item.badge}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="kpi-hub-muted">Không có mục ưu tiên.</p>
        )}
      </section>
      <section>
        <h2 className="kpi-hub-section-title">DV health</h2>
        <div className="kpi-hub-table-wrap">
          <table className="kpi-hub-table">
            <thead>
              <tr>
                <th>DV</th>
                <th>KPI health</th>
                <th>GM</th>
              </tr>
            </thead>
            <tbody>
              {data.dv_health.map((row) => (
                <tr key={row.dv_code}>
                  <td>{row.dv_code}</td>
                  <td>{row.kpi_health_pct}%</td>
                  <td>{row.gm_pct != null ? `${row.gm_pct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
