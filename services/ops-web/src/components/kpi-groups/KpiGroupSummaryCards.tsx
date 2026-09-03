'use client';

import type { KpiGroupSummary } from '@/lib/kpi-groups-api';

type KpiGroupSummaryCardsProps = {
  summary: KpiGroupSummary | null;
  loading?: boolean;
};

const CARDS: Array<{ key: keyof KpiGroupSummary; label: string; hint: string; className: string }> = [
  { key: 'total', label: 'Tổng nhóm KPI', hint: 'Tất cả trạng thái', className: 'kpi-group-summary-card--total' },
  { key: 'active', label: 'Đang hoạt động', hint: 'Sẵn sàng gán chỉ tiêu', className: 'kpi-group-summary-card--active' },
  { key: 'draft', label: 'Bản nháp', hint: 'Chưa kích hoạt', className: 'kpi-group-summary-card--draft' },
  { key: 'inactive', label: 'Ngừng sử dụng', hint: 'Không dùng cho dữ liệu mới', className: 'kpi-group-summary-card--inactive' },
];

export function KpiGroupSummaryCards({ summary, loading }: KpiGroupSummaryCardsProps) {
  return (
    <div className="kpi-group-summary-grid" aria-label="Thống kê Nhóm KPI">
      {CARDS.map((card) => (
        <article key={card.key} className={`kpi-group-summary-card ${card.className}`}>
          <p className="kpi-group-summary-card__label">{card.label}</p>
          <p className="kpi-group-summary-card__value">
            {loading ? '…' : (summary?.[card.key] ?? 0).toLocaleString('vi-VN')}
          </p>
          <p className="kpi-group-summary-card__hint">{card.hint}</p>
        </article>
      ))}
    </div>
  );
}
