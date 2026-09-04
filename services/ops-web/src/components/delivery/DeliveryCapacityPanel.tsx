'use client';

import type { CapacityTeamRow } from '@/lib/delivery-projects-api';

type DeliveryCapacityPanelProps = {
  teams: CapacityTeamRow[];
  loading?: boolean;
};

export function DeliveryCapacityPanel({ teams, loading }: DeliveryCapacityPanelProps) {
  if (loading) {
    return (
      <div data-testid="delivery-capacity-panel">
        <p className="muted">Đang tải capacity…</p>
      </div>
    );
  }
  if (teams.length === 0) {
    return (
      <div className="delivery-empty-panel" data-testid="delivery-capacity-panel">
        <h4>Capacity Planning</h4>
        <p>Chưa có phân bổ nguồn lực active/draft trong kỳ.</p>
      </div>
    );
  }

  return (
    <div className="delivery-capacity-grid" data-testid="delivery-capacity-panel">
      {teams.map((team) => (
        <div key={team.team} className="delivery-capacity-team">
          <div className="delivery-capacity-team__head">
            <strong>{team.team}</strong>
            <span className={team.peak_pct > 100 ? 'delivery-capacity-over' : 'delivery-capacity-ok'}>
              Peak {team.peak_pct}%
            </span>
          </div>
          <div className="delivery-capacity-bars">
            {team.weeks.map((w) => (
              <div key={`${team.team}-${w.week}`} className="delivery-capacity-bar-row">
                <span className="delivery-capacity-bar-label">T{w.week}</span>
                <div className="delivery-capacity-bar-track">
                  <div
                    className={`delivery-capacity-bar-fill${w.overloaded ? ' delivery-capacity-bar-fill--over' : ''}`}
                    style={{ width: `${Math.min(100, w.pct)}%` }}
                  />
                </div>
                <span>{w.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
