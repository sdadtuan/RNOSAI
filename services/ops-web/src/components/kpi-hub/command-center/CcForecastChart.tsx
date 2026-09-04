'use client';

import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  series: CommandCenterResponse['series'];
  title?: string;
  testId?: string;
};

export function CcForecastChart({
  series,
  title = 'KPI Performance & Forecast',
  testId = 'exec-forecast',
}: Props) {
  const actual = series.actual.filter((p) => p.value != null);
  const target = series.target.filter((p) => p.value != null);
  const hasForecast = series.forecast != null;

  const allValues = [...actual, ...target].map((p) => p.value ?? 0);
  const maxVal = allValues.length ? Math.max(...allValues, 1) : 1;

  return (
    <article className="kpi-hub-card cc-chart" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>{title}</h2>
      </header>
      {actual.length === 0 && target.length === 0 ? (
        <p className="cc-empty">Chưa có dữ liệu chuỗi thời gian.</p>
      ) : (
        <div className="cc-chart__plot" aria-hidden>
          <svg viewBox="0 0 400 120" className="cc-chart__svg">
            {actual.map((p, i) => {
              const x = 20 + (i / Math.max(actual.length - 1, 1)) * 360;
              const h = ((p.value ?? 0) / maxVal) * 80;
              return (
                <rect
                  key={`a-${p.date}`}
                  x={x - 8}
                  y={100 - h}
                  width={16}
                  height={h}
                  fill="#17692f"
                  opacity={0.85}
                />
              );
            })}
            {target.length > 1 ? (
              <polyline
                points={target
                  .map((p, i) => {
                    const x = 20 + (i / Math.max(target.length - 1, 1)) * 360;
                    const y = 100 - ((p.value ?? 0) / maxVal) * 80;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            ) : null}
          </svg>
        </div>
      )}
      <div className="cc-chart__legend">
        <span className="cc-chart__legend-item">
          <span className="cc-chart__swatch cc-chart__swatch--actual" /> Actual
        </span>
        <span className="cc-chart__legend-item">
          <span className="cc-chart__swatch cc-chart__swatch--target" /> Target
        </span>
        {hasForecast ? (
          <span className="cc-chart__legend-item">
            <span className="cc-chart__swatch cc-chart__swatch--forecast" /> Forecast
          </span>
        ) : null}
      </div>
      {hasForecast ? (
        <p className="cc-chart__note muted">Dự báo dựa trên mô hình đã bật trong Cài đặt Hub.</p>
      ) : null}
    </article>
  );
}
