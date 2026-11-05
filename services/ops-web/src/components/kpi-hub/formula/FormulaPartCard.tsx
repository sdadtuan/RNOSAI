'use client';

import { filtersToDisplay } from '@/lib/kpi-hub-formula-utils';
import type { KpiHubFormulaFilter, KpiHubFormulaPart } from '@/lib/kpi-hub-types';
import { FormulaFilterBuilder } from './FormulaFilterBuilder';

type Props = {
  title: string;
  part: KpiHubFormulaPart;
  filters: KpiHubFormulaFilter[];
  onFiltersChange: (filters: KpiHubFormulaFilter[]) => void;
  onPreview?: () => void;
  previewLoading?: boolean;
};

export function FormulaPartCard({ title, part, filters, onFiltersChange, onPreview, previewLoading }: Props) {
  const filterDisplay = filtersToDisplay(filters) || part.filter;

  return (
    <article className="kpi-hub-card kpi-hub-formula-part">
      <header className="kpi-hub-formula-part__head">
        <span className="muted">{title}</span>
        <span className="kpi-hub-table__mono">{part.code}</span>
      </header>
      <h3>{part.name}</h3>
      <code className="kpi-hub-formula-expr">{part.expression}</code>
      <FormulaFilterBuilder filters={filters} onChange={onFiltersChange} />
      <div className="kpi-hub-formula-part__footer">
        <span className="kpi-hub-chip">{filterDisplay || 'Không có bộ lọc'}</span>
        {onPreview ? (
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--ghost"
            disabled={previewLoading}
            onClick={onPreview}
          >
            {previewLoading ? 'Đang preview…' : 'Preview'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
