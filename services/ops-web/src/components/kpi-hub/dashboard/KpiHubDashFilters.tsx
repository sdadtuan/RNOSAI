'use client';

export function KpiHubDashFilters() {
  return (
    <div className="kpi-hub-dash-filters">
      <select className="kpi-hub-select" defaultValue="">
        <option value="">Toàn bộ phòng ban</option>
      </select>
      <select className="kpi-hub-select" defaultValue="">
        <option value="">Tất cả kênh</option>
      </select>
      <select className="kpi-hub-select" defaultValue="">
        <option value="">Tất cả sản phẩm</option>
      </select>
      <select className="kpi-hub-select" defaultValue="">
        <option value="">Tất cả team</option>
      </select>
      <button type="button" className="kpi-hub-link-btn">
        Đặt lại bộ lọc
      </button>
    </div>
  );
}
