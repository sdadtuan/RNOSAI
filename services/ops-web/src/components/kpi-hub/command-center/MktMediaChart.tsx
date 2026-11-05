'use client';

import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  marketing: NonNullable<CommandCenterResponse['marketing']>;
  testId?: string;
};

export function MktMediaChart({ marketing, testId = 'mkt-media-chart' }: Props) {
  const series = marketing.spend_series;
  const maxSpend = Math.max(...series.map((p) => p.spend ?? 0), 1);

  return (
    <article className="kpi-hub-card cc-chart" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Hiệu quả Media & Chuyển đổi</h2>
      </header>
      {series.length === 0 ? (
        <p className="cc-empty">Chưa có dữ liệu chi tiêu theo ngày.</p>
      ) : (
        <div className="cc-chart__plot cc-chart__plot--media" aria-hidden>
          <svg viewBox="0 0 400 120" className="cc-chart__svg">
            {series.map((p, i) => {
              const x = 20 + (i / Math.max(series.length - 1, 1)) * 360;
              const h = ((p.spend ?? 0) / maxSpend) * 70;
              return (
                <rect key={p.date} x={x - 6} y={90 - h} width={12} height={h} fill="#17692f" opacity={0.8} />
              );
            })}
            {series.some((p) => p.valid_leads != null) ? (
              <polyline
                points={series
                  .map((p, i) => {
                    const maxLeads = Math.max(...series.map((s) => s.valid_leads ?? 0), 1);
                    const x = 20 + (i / Math.max(series.length - 1, 1)) * 360;
                    const y = 90 - ((p.valid_leads ?? 0) / maxLeads) * 70;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#059669"
                strokeWidth="2"
              />
            ) : null}
          </svg>
        </div>
      )}
      {marketing.insight ? <p className="cc-insight">{marketing.insight}</p> : null}
      <p className="cc-attribution muted">Mô hình: Last-touch · cửa sổ Hub</p>
    </article>
  );
}
