'use client';

import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

export function TargetTab({ row }: { row: KpiHubDictionaryRow }) {
  return (
    <div className="kpi-hub-tab-panel">
      <section className="kpi-hub-card">
        <h2>Target & ngưỡng</h2>
        <p className="muted">Thiết lập target cho {row.name} — sẽ được bổ sung ở sóng Target.</p>
        <div className="kpi-hub-form-grid">
          <label>
            Target
            <input className="kpi-hub-input" defaultValue={row.targetLabel ?? ''} placeholder="VD: ≤ 150.000 VND" />
          </label>
          <label>
            Hướng
            <select className="kpi-hub-select" defaultValue={row.direction}>
              <option value="HIGHER_IS_BETTER">Cao hơn tốt hơn</option>
              <option value="LOWER_IS_BETTER">Thấp hơn tốt hơn</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
