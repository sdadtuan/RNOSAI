'use client';

import { KPI_HUB_REPORTS } from '@/lib/kpi-hub-fixtures';

export function KpiHubReportSummaryCards() {
  const s = KPI_HUB_REPORTS.summary;
  return (
    <div className="kpi-hub-summary-grid">
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Tổng báo cáo</p>
        <p className="kpi-hub-summary-card__value">{s.total}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Của tôi</p>
        <p className="kpi-hub-summary-card__value">{s.mine}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card">
        <p className="kpi-hub-summary-card__label">Đã chia sẻ</p>
        <p className="kpi-hub-summary-card__value">{s.shared}</p>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card kpi-hub-summary-card--green">
        <p className="kpi-hub-summary-card__label">Đã gửi tháng này</p>
        <p className="kpi-hub-summary-card__value">{s.sentThisMonth}</p>
      </article>
    </div>
  );
}

export function KpiHubReportTabs({ active, onChange }: { active: string; onChange: (tab: string) => void }) {
  return (
    <nav className="kpi-hub-tabs kpi-hub-tabs--compact" aria-label="Report tabs">
      {KPI_HUB_REPORTS.tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`kpi-hub-tabs__item${active === tab ? ' is-active' : ''}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

export function KpiHubReportList() {
  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>Tên báo cáo</th>
            <th>Loại</th>
            <th>Owner</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {KPI_HUB_REPORTS.items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.type}</td>
              <td>{item.owner}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpiHubReportRail() {
  const { quickCreate, nextSchedule, recentShares } = KPI_HUB_REPORTS;
  return (
    <aside className="kpi-hub-rail">
      <section className="kpi-hub-card">
        <h3>Tạo nhanh</h3>
        <div className="kpi-hub-quick-grid">
          {quickCreate.map((label) => (
            <button key={label} type="button" className="kpi-hub-quick-card">
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="kpi-hub-card">
        <h3>Lịch gửi tiếp theo</h3>
        <p>
          <strong>{nextSchedule.name}</strong>
        </p>
        <p className="muted">
          {nextSchedule.at} · {nextSchedule.channel}
        </p>
      </section>
      <section className="kpi-hub-card">
        <h3>Chia sẻ gần đây</h3>
        <ul className="kpi-hub-share-list">
          {recentShares.map((s) => (
            <li key={`${s.report}-${s.user}`}>
              <strong>{s.report}</strong>
              <span className="muted">
                {s.user} · {s.at}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
