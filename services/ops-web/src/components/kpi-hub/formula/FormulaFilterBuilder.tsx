'use client';

import {
  FORMULA_FILTER_FIELDS,
  FORMULA_FILTER_OPERATORS,
  createFormulaFilter,
  removeFilter,
  toggleFilterJoin,
  updateFilter,
} from '@/lib/kpi-hub-formula-utils';
import type { KpiHubFormulaFilter } from '@/lib/kpi-hub-types';

type Props = {
  filters: KpiHubFormulaFilter[];
  onChange: (filters: KpiHubFormulaFilter[]) => void;
};

export function FormulaFilterBuilder({ filters, onChange }: Props) {
  return (
    <div className="kpi-hub-formula-filter-builder">
      {filters.map((filter, index) => (
        <div key={filter.id} className="kpi-hub-formula-filter-builder__row">
          {index > 0 ? (
            <button
              type="button"
              className={`kpi-hub-formula-filter-builder__join kpi-hub-chip${filter.join === 'OR' ? ' is-or' : ''}`}
              onClick={() => onChange(toggleFilterJoin(filters, filter.id))}
            >
              {filter.join ?? 'AND'}
            </button>
          ) : (
            <span className="kpi-hub-formula-filter-builder__join-spacer" aria-hidden />
          )}
          <select
            className="kpi-hub-select"
            value={filter.field}
            onChange={(e) => onChange(updateFilter(filters, filter.id, { field: e.target.value }))}
          >
            {FORMULA_FILTER_FIELDS.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
          <select
            className="kpi-hub-select"
            value={filter.operator}
            onChange={(e) => onChange(updateFilter(filters, filter.id, { operator: e.target.value }))}
          >
            {FORMULA_FILTER_OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            className="kpi-hub-input"
            value={filter.value}
            placeholder="Giá trị"
            onChange={(e) => onChange(updateFilter(filters, filter.id, { value: e.target.value }))}
          />
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--icon"
            aria-label="Xóa điều kiện"
            onClick={() => onChange(removeFilter(filters, filter.id))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="kpi-hub-link-btn"
        onClick={() =>
          onChange([
            ...filters,
            createFormulaFilter({ join: filters.length ? 'AND' : undefined }),
          ])
        }
      >
        + Thêm điều kiện
      </button>
    </div>
  );
}
