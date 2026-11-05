'use client';

type ReportSummary = {
  total: number;
  mine: number;
  shared: number;
  sentThisMonth: number;
};

type ReportItem = {
  id: string;
  name: string;
  type: string;
  owner: string;
  status: string;
};

export function KpiHubReportSummaryCards({
  summary,
  loading,
}: {
  summary: ReportSummary;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="kpi-hub-summary-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="kpi-hub-card kpi-hub-summary-card kpi-hub-skeleton-card">
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--lg" />
          </article>
        ))}
      </div>
    );
  }

  const s = summary;
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

export function KpiHubReportTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <nav className="kpi-hub-tabs kpi-hub-tabs--compact" aria-label="Report tabs">
      {tabs.map((tab) => (
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

export function KpiHubReportList({ items }: { items: ReportItem[] }) {
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
          {items.map((item) => (
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

export function KpiHubReportRail({
  quickCreate,
  nextSchedule,
  recentShares,
}: {
  quickCreate: readonly string[];
  nextSchedule: { name: string; at: string; channel: string };
  recentShares: Array<{ report: string; user: string; at: string }>;
}) {
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
        <ul className="kpi-hub-checklist">
          {recentShares.map((s) => (
            <li key={`${s.report}-${s.user}`}>
              {s.report} → {s.user} <span className="muted">({s.at})</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
