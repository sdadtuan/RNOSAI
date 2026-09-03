'use client';

import { KPI_HUB_WORKSPACE } from '@/lib/kpi-hub-fixtures';

export function WorkspacePanel() {
  const w = KPI_HUB_WORKSPACE;
  return (
    <div className="kpi-hub-settings-panel">
      <section className="kpi-hub-card">
        <h2>Không gian làm việc</h2>
        <div className="kpi-hub-form-grid">
          <label>
            Tên workspace
            <input className="kpi-hub-input" defaultValue={w.name} />
          </label>
          <label>
            Công ty
            <input className="kpi-hub-input" defaultValue={w.company} />
          </label>
          <label>
            Múi giờ
            <input className="kpi-hub-input" defaultValue={w.timezone} />
          </label>
          <label>
            Locale
            <input className="kpi-hub-input" defaultValue={w.locale} />
          </label>
          <label>
            Tiền tệ
            <input className="kpi-hub-input" defaultValue={w.currency} />
          </label>
          <label>
            Chu kỳ mặc định
            <span className="kpi-hub-chip">Tháng</span>
          </label>
          <label>
            Ngày chốt kỳ
            <input className="kpi-hub-input" type="number" defaultValue={w.closeDay} />
          </label>
          <label>
            Ngày đối soát
            <input className="kpi-hub-input" type="number" defaultValue={w.reconcileDay} />
          </label>
        </div>
      </section>
      <section className="kpi-hub-card kpi-hub-danger-zone">
        <h2>Danger zone</h2>
        <p className="muted">Thao tác không thể hoàn tác — cần xác nhận Super Admin.</p>
        <div className="kpi-hub-danger-zone__actions">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--danger">
            Khóa kỳ đã chốt
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--danger">
            Xóa workspace
          </button>
        </div>
      </section>
    </div>
  );
}
