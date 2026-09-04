'use client';

import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type QualitySummary = {
  score: number;
  sourcesOk: number;
  sourcesTotal: number;
  warnings: number;
  critical: number;
  trend: number[];
  freshness: Array<{ name: string; status: string; lag: string }>;
  rules: Array<{ id: string; name: string; severity: string; passRate: number; status: string }>;
  issue: {
    id: string;
    rule: string;
    count: number;
    sample: string;
    assignee: string | null;
  };
};

export function KpiHubQualityScore({ score, loading }: { score: number; loading?: boolean }) {
  if (loading) {
    return (
      <article className="kpi-hub-card kpi-hub-quality-score kpi-hub-skeleton-card">
        <div className="kpi-hub-skeleton kpi-hub-skeleton--line" />
      </article>
    );
  }

  return (
    <article className="kpi-hub-card kpi-hub-quality-score">
      <h2>Điểm chất lượng</h2>
      <div className="kpi-hub-quality-gauge">
        <svg viewBox="0 0 120 70">
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <path
            d="M10,60 A50,50 0 0,1 110,60"
            fill="none"
            stroke="#10B981"
            strokeWidth="10"
            strokeDasharray={`${(score / 100) * 157} 157`}
          />
          <text x="60" y="52" textAnchor="middle" className="kpi-hub-quality-gauge__value">
            {score}
          </text>
          <text x="60" y="66" textAnchor="middle" className="muted">
            /100
          </text>
        </svg>
      </div>
    </article>
  );
}

export function KpiHubQualitySummaryCards({ data, loading }: { data: QualitySummary; loading?: boolean }) {
  if (loading) {
    return (
      <div className="kpi-hub-quality-mini-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <article key={i} className="kpi-hub-card kpi-hub-skeleton-card">
            <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--lg" />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-hub-quality-mini-grid">
      <article className="kpi-hub-card">
        <p className="muted">Nguồn OK</p>
        <strong>
          {data.sourcesOk}/{data.sourcesTotal}
        </strong>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card--amber">
        <p className="muted">Warning</p>
        <strong>{data.warnings}</strong>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card--red">
        <p className="muted">Critical</p>
        <strong>{data.critical}</strong>
      </article>
    </div>
  );
}

export function KpiHubQualityTrend({ trend }: { trend: number[] }) {
  const max = Math.max(...trend);
  const min = Math.min(...trend);
  const points = trend
    .map((v, i) => {
      const x = (i / (trend.length - 1)) * 100;
      const y = 100 - ((v - min) / (max - min || 1)) * 80 - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <article className="kpi-hub-card kpi-hub-quality-trend">
      <h2>Xu hướng điểm DQ</h2>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="kpi-hub-quality-trend__chart">
        <polyline points={points} fill="none" stroke="#10B981" strokeWidth="2" />
      </svg>
    </article>
  );
}

export function KpiHubQualityFreshness({
  freshness,
}: {
  freshness: QualitySummary['freshness'];
}) {
  return (
    <article className="kpi-hub-card">
      <h2>Freshness nguồn</h2>
      <ul className="kpi-hub-freshness-list">
        {freshness.map((f) => (
          <li key={f.name}>
            <span>{f.name}</span>
            <KpiHubStatusBadge kind="freshness" status={f.status} />
            <span className="muted">{f.lag}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function KpiHubQualityRulesTable({
  rules,
  onSelectIssue,
}: {
  rules: QualitySummary['rules'];
  onSelectIssue: () => void;
}) {
  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Mức độ</th>
            <th>Pass rate</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} onClick={onSelectIssue} className={r.status === 'WARN' ? 'is-clickable' : ''}>
              <td>{r.name}</td>
              <td>{r.severity}</td>
              <td>{r.passRate}%</td>
              <td>
                <KpiHubStatusBadge
                  kind="perf"
                  status={r.status === 'PASS' ? 'ACHIEVED' : r.status === 'WARN' ? 'WARNING' : 'CRITICAL'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpiHubQualityIssueDrawer({
  issue,
  open,
  onClose,
}: {
  issue: QualitySummary['issue'];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <aside className="kpi-hub-drawer">
      <header className="kpi-hub-drawer__head">
        <div>
          <h2>{issue.rule}</h2>
          <span>{issue.count} lỗi</span>
        </div>
        <button type="button" className="kpi-hub-drawer__close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="kpi-hub-drawer__body">
        <p>
          Sample: <code>{issue.sample}</code>
        </p>
        <p className="kpi-hub-code-block">Lead_ID IS NOT NULL</p>
        <div className="kpi-hub-drawer__foot kpi-hub-drawer__foot--inline">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
            Gán người xử lý
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary">
            Tạo ticket
          </button>
        </div>
      </div>
    </aside>
  );
}
