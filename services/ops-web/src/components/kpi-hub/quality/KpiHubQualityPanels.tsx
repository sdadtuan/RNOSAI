'use client';

import { KPI_HUB_QUALITY } from '@/lib/kpi-hub-fixtures';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

export function KpiHubQualityScore() {
  const { score } = KPI_HUB_QUALITY;
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

export function KpiHubQualitySummaryCards() {
  const q = KPI_HUB_QUALITY;
  return (
    <div className="kpi-hub-quality-mini-grid">
      <article className="kpi-hub-card">
        <p className="muted">Nguồn OK</p>
        <strong>
          {q.sourcesOk}/{q.sourcesTotal}
        </strong>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card--amber">
        <p className="muted">Warning</p>
        <strong>{q.warnings}</strong>
      </article>
      <article className="kpi-hub-card kpi-hub-summary-card--red">
        <p className="muted">Critical</p>
        <strong>{q.critical}</strong>
      </article>
    </div>
  );
}

export function KpiHubQualityTrend() {
  const { trend } = KPI_HUB_QUALITY;
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

export function KpiHubQualityFreshness() {
  const { freshness } = KPI_HUB_QUALITY;
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

export function KpiHubQualityRulesTable({ onSelectIssue }: { onSelectIssue: () => void }) {
  const { rules } = KPI_HUB_QUALITY;
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

export function KpiHubQualityIssueDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const issue = KPI_HUB_QUALITY.issue;
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
