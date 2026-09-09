'use client';

import Link from 'next/link';
import type { ServiceKpiWarRoomData } from '@/lib/service-kpi-types';

type Props = {
  data: ServiceKpiWarRoomData;
  loading?: boolean;
  error?: string | null;
};

function badgeClass(badge: string): string {
  if (badge === 'At-risk' || badge === 'Blocked') return 'kpi-hub-badge--red';
  if (badge === 'Assumption') return 'kpi-hub-badge--amber';
  return 'kpi-hub-badge--amber';
}

export function ServiceKpiWarRoom({ data, loading, error }: Props) {
  if (loading) return <p className="kpi-hub-muted">Đang tải War Room…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;

  return (
    <div className="kpi-hub-skpi-warroom">
      <div className="kpi-hub-skpi-kpis">
        <article className="kpi-hub-skpi-kpi kpi-hub-skpi-kpi--critical">
          <label>Critical / At-risk</label>
          <b>{data.critical_overdue}</b>
          <span>KPI vượt ngưỡng</span>
        </article>
        <article className="kpi-hub-skpi-kpi kpi-hub-skpi-kpi--warn">
          <label>Assumption mở</label>
          <b>{data.assumptions_open}</b>
          <span>Pending / not met</span>
        </article>
        <article className="kpi-hub-skpi-kpi kpi-hub-skpi-kpi--warn">
          <label>Cấm xuất Report</label>
          <b>{data.blocked_reports}</b>
          <span>Actual pending</span>
        </article>
        <article
          className={`kpi-hub-skpi-kpi${data.quotes_score_gte_70 ? ' kpi-hub-skpi-kpi--critical' : ''}`}
        >
          <label>Quote score ≥ 70</label>
          <b>{data.quotes_score_gte_70}</b>
          <span>Cùng GM floor</span>
        </article>
      </div>

      <div className="kpi-hub-skpi-measurement-form__layout">
        <section className="kpi-hub-skpi-queue">
          <h2 className="kpi-hub-section-title">Hàng đợi việc — hôm nay</h2>
          {data.queue.length ? (
            <ul className="kpi-hub-skpi-queue-list">
              {data.queue.map((item) => (
                <li key={`${item.href}-${item.title}`} className="kpi-hub-skpi-queue-row">
                  <div className="kpi-hub-skpi-queue-row__body">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                  <span className={`kpi-hub-badge ${badgeClass(item.badge)}`}>{item.badge}</span>
                  {item.action_href && item.action_label ? (
                    <Link href={item.action_href} className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm">
                      {item.action_label}
                    </Link>
                  ) : (
                    <Link href={item.href} className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm">
                      Mở
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="kpi-hub-muted">Không có mục ưu tiên.</p>
          )}
        </section>

        <aside className="kpi-hub-card kpi-hub-skpi-readiness">
          <header className="kpi-hub-card__head">
            <h2>Nhịp tuần bắt buộc</h2>
          </header>
          <div className="kpi-hub-card__body">
            <ul className="kpi-hub-skpi-readiness-list">
              <li className={data.assumptions_open ? 'is-warn' : 'is-ok'}>
                1. Assumption — {data.assumptions_open} mở
              </li>
              <li className={data.critical_overdue ? 'is-warn' : 'is-ok'}>
                2. Alert quá hạn — {data.critical_overdue}
              </li>
              <li className={data.blocked_reports ? 'is-warn' : 'is-ok'}>
                3. Data stale — {data.blocked_reports} chặn report
              </li>
              <li>4. KPI + GM — xem DV health</li>
              <li className={data.quotes_score_gte_70 ? 'is-warn' : ''}>
                5. Quote score ≥70 — {data.quotes_score_gte_70}
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <section>
        <h2 className="kpi-hub-section-title">DV lệch KPI và margin</h2>
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
              {data.dv_health.length ? (
                data.dv_health.map((row) => (
                  <tr key={row.dv_code}>
                    <td>{row.dv_code}</td>
                    <td>{row.kpi_health_pct}%</td>
                    <td>{row.gm_pct != null ? `${row.gm_pct}%` : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="kpi-hub-muted">
                    Chưa có instance theo DV
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
