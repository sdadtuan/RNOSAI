'use client';

import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

export function OverviewTab({ row }: { row: KpiHubDictionaryRow }) {
  return (
    <div className="kpi-hub-tab-panel">
      <section className="kpi-hub-card">
        <h2>Thông tin KPI</h2>
        <div className="kpi-hub-form-grid">
          <label>
            Tên Metric
            <input className="kpi-hub-input" defaultValue={row.name} />
          </label>
          <label>
            Mã KPI
            <input className="kpi-hub-input" defaultValue={row.code} readOnly />
          </label>
          <label>
            Nhóm KPI
            <input className="kpi-hub-input" defaultValue={row.groupLabel} readOnly />
          </label>
          <label>
            Data Owner
            <input className="kpi-hub-input" defaultValue={row.dataOwner} />
          </label>
          <label className="kpi-hub-form-grid__full">
            Mô tả
            <textarea className="kpi-hub-input" rows={3} defaultValue={row.formulaDisplay ?? ''} />
          </label>
        </div>
      </section>
    </div>
  );
}
