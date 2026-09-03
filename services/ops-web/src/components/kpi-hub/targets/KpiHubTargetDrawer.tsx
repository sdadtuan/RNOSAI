'use client';

import { KPI_HUB_TARGETS } from '@/lib/kpi-hub-fixtures';

type Props = {
  targetId: string | null;
  onClose: () => void;
};

export function KpiHubTargetDrawer({ targetId, onClose }: Props) {
  const row = KPI_HUB_TARGETS.rows.find((r) => r.id === targetId);
  if (!row) return null;

  const gaugePct = row.code === 'MKT_006' ? 95 : 68;

  return (
    <aside className="kpi-hub-drawer" aria-label="Chi tiết Target">
      <header className="kpi-hub-drawer__head">
        <div>
          <h2>{row.name}</h2>
          <span className="kpi-hub-table__mono">{row.code}</span>
        </div>
        <button type="button" className="kpi-hub-drawer__close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="kpi-hub-drawer__body">
        <p className="muted">Lower is better · Kỳ 09/2026</p>
        <div className="kpi-hub-gauge">
          <svg viewBox="0 0 120 70" aria-label={`${gaugePct}%`}>
            <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <path
              d="M10,60 A50,50 0 0,1 110,60"
              fill="none"
              stroke="#10B981"
              strokeWidth="10"
              strokeDasharray={`${(gaugePct / 100) * 157} 157`}
            />
            <text x="60" y="55" textAnchor="middle" className="kpi-hub-gauge__value">
              {row.actualFmt}
            </text>
          </svg>
          <p>
            Target: <strong>{row.targetFmt}</strong>
          </p>
        </div>
        <section className="kpi-hub-drawer__section">
          <h3>Cảnh báo</h3>
          <p>Gửi lại sau 4 giờ nếu chưa xử lý</p>
          <div className="kpi-hub-chip-row">
            <span className="kpi-hub-chip">Email</span>
            <span className="kpi-hub-chip">Teams</span>
          </div>
        </section>
      </div>
    </aside>
  );
}
