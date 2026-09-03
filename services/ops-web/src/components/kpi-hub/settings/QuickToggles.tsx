'use client';

import { KPI_HUB_WORKSPACE } from '@/lib/kpi-hub-fixtures';

export function QuickToggles() {
  const w = KPI_HUB_WORKSPACE;
  return (
    <section className="kpi-hub-card">
      <h3>Toggle nhanh</h3>
      <div className="kpi-hub-toggle-list">
        <label className="kpi-hub-toggle">
          <input type="checkbox" defaultChecked={w.lockClosedPeriods} />
          Khóa kỳ đã chốt
        </label>
        <label className="kpi-hub-toggle">
          <input type="checkbox" defaultChecked={w.requireKpiApproval} />
          Yêu cầu phê duyệt KPI
        </label>
        <label className="kpi-hub-toggle">
          <input type="checkbox" defaultChecked={w.autoQuality} />
          Tự chạy Data Quality
        </label>
        <label className="kpi-hub-toggle">
          <input type="checkbox" defaultChecked={w.alertsEnabled} />
          Bật cảnh báo
        </label>
      </div>
    </section>
  );
}
