'use client';

import type { KpiTypeSummary } from '@/lib/kpi-types-api';

const CARDS: Array<{ key: keyof KpiTypeSummary; label: string; hint: string; className: string }> = [
  { key: 'total', label: 'Tổng KPI Type', hint: 'Tất cả trạng thái', className: '' },
  { key: 'active', label: 'Đang hoạt động', hint: 'Sẵn sàng gán chỉ tiêu', className: 'kpi-type-summary-card--active' },
  { key: 'draft', label: 'Bản nháp', hint: 'Chưa kích hoạt', className: 'kpi-type-summary-card--draft' },
  { key: 'auto', label: 'Có đồng bộ tự động', hint: 'AUTO / HYBRID', className: 'kpi-type-summary-card--auto' },
];

export function KpiTypeSummaryCards({
  summary,
  loading,
}: {
  summary: KpiTypeSummary | null;
  loading?: boolean;
}) {
  return (
    <div className="kpi-type-summary-grid" aria-label="Thống kê KPI Type">
      {CARDS.map((card) => (
        <article key={card.key} className={`kpi-type-summary-card ${card.className}`}>
          <p className="kpi-type-summary-card__label">{card.label}</p>
          <p className="kpi-type-summary-card__value">
            {loading ? '…' : (summary?.[card.key] ?? 0).toLocaleString('vi-VN')}
          </p>
          <p className="kpi-type-summary-card__hint">{card.hint}</p>
        </article>
      ))}
    </div>
  );
}
