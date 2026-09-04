'use client';

import type { DeliveryProjectRow } from '@/lib/delivery-projects-api';
import { labelDeliveryHealth } from '@/lib/delivery-projects.util';

type DeliveryHealthDonutProps = {
  rows: DeliveryProjectRow[];
  onViewRisk?: () => void;
};

export function DeliveryHealthDonut({ rows, onViewRisk }: DeliveryHealthDonutProps) {
  const stable = rows.filter((r) => r.health_status === 'stable').length;
  const needsAttention = rows.filter((r) => r.health_status === 'needs_attention').length;
  const atRisk = rows.filter((r) => r.health_status === 'at_risk' || r.health_status === 'overdue').length;
  const noData = rows.filter((r) => r.health_status === 'no_data').length;
  const total = rows.length || 1;

  const segments = [
    { key: 'stable', count: stable, color: '#17692f', label: labelDeliveryHealth('stable') },
    { key: 'needs_attention', count: needsAttention, color: '#c58a00', label: labelDeliveryHealth('needs_attention') },
    { key: 'at_risk', count: atRisk, color: '#dc2626', label: 'Rủi ro / Quá hạn' },
    { key: 'no_data', count: noData, color: '#d1d5db', label: labelDeliveryHealth('no_data') },
  ];

  let offset = 0;
  const gradientParts = segments
    .filter((s) => s.count > 0)
    .map((s) => {
      const pct = (s.count / total) * 100;
      const part = `${s.color} ${offset}% ${offset + pct}%`;
      offset += pct;
      return part;
    });

  const gradient =
    gradientParts.length > 0 ? `conic-gradient(${gradientParts.join(', ')})` : 'conic-gradient(#e5e7eb 0% 100%)';

  return (
    <div className="delivery-panel" data-testid="delivery-health-donut">
      <h3 className="delivery-panel__title">Sức khỏe dự án</h3>
      <div className="delivery-donut-wrap">
        <div className="delivery-donut" style={{ background: gradient }} aria-hidden>
          <span className="delivery-donut__center">{rows.length}</span>
        </div>
        <ul className="delivery-donut-legend">
          {segments.map((s) => (
            <li key={s.key}>
              <span className="delivery-donut-legend__swatch" style={{ background: s.color }} />
              {s.label}: {s.count}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="delivery-btn delivery-btn--ghost" onClick={onViewRisk}>
        Xem Risk Register
      </button>
    </div>
  );
}
