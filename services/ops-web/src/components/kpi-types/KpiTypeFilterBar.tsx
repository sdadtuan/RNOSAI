'use client';

import { FilterBar, FilterBarActions, FilterBarSearch } from '@/components/layout';
import {
  KPI_TYPE_STATUSES,
  labelKpiTypeCalc,
  labelKpiTypeDirection,
  labelKpiTypeStatus,
  type KpiTypeCalculationMode,
  type KpiTypeDirection,
  type KpiTypeStatus,
} from '@/lib/kpi-type-util';
import type { KpiTypeRef } from '@/lib/kpi-types-api';

export type KpiTypeFilters = {
  q: string;
  status: '' | KpiTypeStatus;
  kpi_group_id: string;
  calculation_mode: '' | KpiTypeCalculationMode;
  direction: '' | KpiTypeDirection;
};

export function KpiTypeFilterBar({
  filters,
  groups,
  onChange,
  onSearch,
  onClear,
}: {
  filters: KpiTypeFilters;
  groups: KpiTypeRef[];
  onChange: (next: KpiTypeFilters) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  const hasActive = Boolean(
    filters.q || filters.status || filters.kpi_group_id || filters.calculation_mode || filters.direction,
  );

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
        placeholder="Tìm theo mã, tên, mô tả hoặc công thức..."
      />
      <select
        className="kpi-type-filter-select"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as KpiTypeFilters['status'] })}
        aria-label="Lọc trạng thái"
      >
        <option value="">Trạng thái</option>
        {KPI_TYPE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {labelKpiTypeStatus(s)}
          </option>
        ))}
      </select>
      <select
        className="kpi-type-filter-select"
        value={filters.kpi_group_id}
        onChange={(e) => onChange({ ...filters, kpi_group_id: e.target.value })}
        aria-label="Lọc Nhóm KPI"
      >
        <option value="">Nhóm KPI</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <select
        className="kpi-type-filter-select"
        value={filters.calculation_mode}
        onChange={(e) =>
          onChange({ ...filters, calculation_mode: e.target.value as KpiTypeFilters['calculation_mode'] })
        }
        aria-label="Lọc cách tính"
      >
        <option value="">Cách tính</option>
        {(['AUTO', 'MANUAL', 'HYBRID'] as const).map((m) => (
          <option key={m} value={m}>
            {labelKpiTypeCalc(m)}
          </option>
        ))}
      </select>
      <select
        className="kpi-type-filter-select"
        value={filters.direction}
        onChange={(e) => onChange({ ...filters, direction: e.target.value as KpiTypeFilters['direction'] })}
        aria-label="Lọc hướng đo"
      >
        <option value="">Hướng đo</option>
        {(['INCREASE', 'DECREASE', 'RANGE'] as const).map((d) => (
          <option key={d} value={d}>
            {labelKpiTypeDirection(d)}
          </option>
        ))}
      </select>
      <FilterBarActions>
        <button type="submit" className="btn btn-sm btn-secondary">
          Tìm
        </button>
        {hasActive ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
            Xóa bộ lọc
          </button>
        ) : null}
      </FilterBarActions>
    </FilterBar>
  );
}
