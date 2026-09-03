'use client';

import { FilterBar, FilterBarActions, FilterBarSearch } from '@/components/layout';
import { KPI_GROUP_STATUSES, labelKpiGroupScope, labelKpiGroupStatus } from '@/lib/kpi-group-util';
import type { KpiGroupScopeType, KpiGroupStatus } from '@/lib/kpi-group-util';
import type { StaffDepartmentRow } from '@/lib/api';

export type KpiGroupFilters = {
  q: string;
  status: '' | KpiGroupStatus;
  department_id: string;
  scope_type: '' | KpiGroupScopeType;
};

type KpiGroupFilterBarProps = {
  filters: KpiGroupFilters;
  departments: StaffDepartmentRow[];
  onChange: (next: KpiGroupFilters) => void;
  onSearch: () => void;
  onClear: () => void;
};

const SCOPE_OPTIONS: KpiGroupScopeType[] = ['ORGANIZATION', 'DEPARTMENT', 'POSITION'];

export function KpiGroupFilterBar({
  filters,
  departments,
  onChange,
  onSearch,
  onClear,
}: KpiGroupFilterBarProps) {
  const hasActiveFilters = Boolean(filters.status || filters.department_id || filters.scope_type || filters.q);

  return (
    <FilterBar
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <FilterBarSearch
        value={filters.q}
        onChange={(q) => onChange({ ...filters, q })}
        placeholder="Tìm theo mã, tên hoặc mô tả..."
      />
      <select
        className="kpi-group-filter-select"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as KpiGroupFilters['status'] })}
        aria-label="Lọc trạng thái"
      >
        <option value="">Trạng thái</option>
        {KPI_GROUP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {labelKpiGroupStatus(s)}
          </option>
        ))}
      </select>
      <select
        className="kpi-group-filter-select"
        value={filters.department_id}
        onChange={(e) => onChange({ ...filters, department_id: e.target.value })}
        aria-label="Lọc phòng ban"
      >
        <option value="">Phòng ban</option>
        {departments.map((d) => (
          <option key={d.id} value={String(d.id)}>
            {d.name}
          </option>
        ))}
      </select>
      <select
        className="kpi-group-filter-select"
        value={filters.scope_type}
        onChange={(e) => onChange({ ...filters, scope_type: e.target.value as KpiGroupFilters['scope_type'] })}
        aria-label="Lọc phạm vi áp dụng"
      >
        <option value="">Phạm vi áp dụng</option>
        {SCOPE_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {labelKpiGroupScope(s)}
          </option>
        ))}
      </select>
      <FilterBarActions>
        <button type="submit" className="btn btn-sm btn-secondary">
          Tìm
        </button>
        {hasActiveFilters ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
            Xóa bộ lọc
          </button>
        ) : null}
      </FilterBarActions>
    </FilterBar>
  );
}
