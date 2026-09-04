'use client';

import type { KpiHubDashboardData, KpiHubDashboardFilters } from '@/lib/kpi-hub-types';

type Props = {
  filters: KpiHubDashboardFilters;
  onChange: (filters: KpiHubDashboardFilters) => void;
  onReset: () => void;
};

export function KpiHubDashFilters({ filters, onChange, onReset }: Props) {
  return (
    <div className="kpi-hub-dash-filters">
      <select
        className="kpi-hub-select"
        value={filters.department ?? ''}
        onChange={(e) => onChange({ ...filters, department: e.target.value || undefined })}
      >
        <option value="">Toàn bộ phòng ban</option>
        <option value="marketing">Marketing</option>
        <option value="sales">Sales</option>
        <option value="finance">Finance</option>
      </select>
      <select
        className="kpi-hub-select"
        value={filters.channel ?? ''}
        onChange={(e) => onChange({ ...filters, channel: e.target.value || undefined })}
      >
        <option value="">Tất cả kênh</option>
        <option value="meta">Meta Ads</option>
        <option value="google">Google Ads</option>
        <option value="organic">Organic</option>
      </select>
      <select
        className="kpi-hub-select"
        value={filters.product ?? ''}
        onChange={(e) => onChange({ ...filters, product: e.target.value || undefined })}
      >
        <option value="">Tất cả sản phẩm</option>
        <option value="bds">Bất động sản</option>
        <option value="dich-vu">Dịch vụ</option>
      </select>
      <select
        className="kpi-hub-select"
        value={filters.team ?? ''}
        onChange={(e) => onChange({ ...filters, team: e.target.value || undefined })}
      >
        <option value="">Tất cả team</option>
        <option value="team-a">Team A</option>
        <option value="team-b">Team B</option>
      </select>
      <button type="button" className="kpi-hub-link-btn" onClick={onReset}>
        Đặt lại bộ lọc
      </button>
    </div>
  );
}
