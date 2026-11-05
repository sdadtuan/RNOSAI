'use client';

import Link from 'next/link';
import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  sales: NonNullable<CommandCenterResponse['sales']>;
  testId?: string;
};

const FLAG_LABELS: Record<string, string> = {
  no_activity: 'Không hoạt động',
  overdue_close: 'Quá hạn đóng',
  stage_aging: 'Kẹt giai đoạn',
  missing_quote: 'Thiếu báo giá',
  missing_next_step: 'Thiếu bước tiếp',
};

export function SalesDealsAtRisk({ sales, testId = 'sales-deals-risk' }: Props) {
  const deals = sales.deals_at_risk;

  return (
    <article className="kpi-hub-card cc-deals-risk" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Deal cần chú ý</h2>
        <Link href="/crm/leads" className="kpi-hub-link-btn">
          Mở Pipeline Board
        </Link>
      </header>
      {deals.length === 0 ? (
        <p className="cc-empty">Không có deal đang rủi ro.</p>
      ) : (
        <ul className="cc-deals-risk__list">
          {deals.map((deal) => (
            <li key={deal.id} className="cc-deals-risk__item">
              <Link href={deal.href || `/crm/leads/${deal.id}`}>
                <strong>{deal.name}</strong>
                <span>{deal.amount != null ? `${deal.amount.toLocaleString('vi-VN')} đ` : '—'}</span>
                <div className="cc-deals-risk__flags">
                  {deal.flags.map((f) => (
                    <span key={f} className="kpi-hub-badge kpi-hub-badge--warning">
                      {FLAG_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
