'use client';

import type { PortfolioSummary } from '@/lib/delivery-portfolio-summary';

type DeliveryTilesProps = {
  summary: PortfolioSummary;
};

function formatMoney(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(v);
}

export function DeliveryTiles({ summary }: DeliveryTilesProps) {
  return (
    <div className="delivery-tile-grid" data-testid="delivery-tiles">
      <div className="delivery-tile">
        <span className="delivery-tile__label">Tổng dự án</span>
        <strong className="delivery-tile__value">{summary.total}</strong>
      </div>
      <div className="delivery-tile">
        <span className="delivery-tile__label">Đúng tiến độ</span>
        <strong className="delivery-tile__value">
          {summary.on_track}/{summary.total}
        </strong>
      </div>
      <div className="delivery-tile">
        <span className="delivery-tile__label">Có rủi ro</span>
        <strong className="delivery-tile__value">{summary.at_risk}</strong>
      </div>
      <div className="delivery-tile">
        <span className="delivery-tile__label">Quá hạn</span>
        <strong className="delivery-tile__value">{summary.overdue}</strong>
      </div>
      <div className="delivery-tile">
        <span className="delivery-tile__label">Ngân sách đã dùng</span>
        <strong className="delivery-tile__value">{formatMoney(summary.budget_used)}</strong>
      </div>
      <div className="delivery-tile">
        <span className="delivery-tile__label">Biên lợi nhuận</span>
        <strong className="delivery-tile__value">
          {summary.margin != null ? `${summary.margin}%` : '—'}
        </strong>
      </div>
      <p className="delivery-tile-footnote">{summary.ingest_active} đang nhận lead</p>
    </div>
  );
}
