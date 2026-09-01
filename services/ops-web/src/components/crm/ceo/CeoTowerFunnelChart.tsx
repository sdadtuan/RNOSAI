'use client';

import type { TowerColumnId } from '@/lib/crm/ceo-tower-api';
import {
  buildTowerFunnelBars,
  type TowerColumnCounts,
  type TowerFactoryFilter,
} from '@/lib/crm/ceo-tower-ui.util';

export type CeoTowerFunnelChartProps = {
  columns: TowerColumnCounts[] | undefined;
  factory: TowerFactoryFilter;
  activeColumnId: TowerColumnId | '';
  onColumn: (id: TowerColumnId) => void;
};

function severityClass(severity: 'red' | 'amber' | 'ok'): string {
  if (severity === 'red') return 'ceo-tower-funnel__col--red';
  if (severity === 'amber') return 'ceo-tower-funnel__col--amber';
  return 'ceo-tower-funnel__col--ok';
}

export function CeoTowerFunnelChart({
  columns,
  factory,
  activeColumnId,
  onColumn,
}: CeoTowerFunnelChartProps) {
  const bars = buildTowerFunnelBars(columns, factory);
  const hasIssues = bars.some((bar) => bar.totalIssues > 0);

  return (
    <div className="ceo-tower-funnel" data-testid="ceo-tower-columns" aria-label="Biểu đồ tháp chu trình">
      <div className="ceo-tower-funnel__legend" aria-hidden="true">
        <span className="ceo-tower-funnel__legend-item">
          <span className="ceo-tower-funnel__swatch ceo-tower-funnel__swatch--red" /> Đỏ
        </span>
        <span className="ceo-tower-funnel__legend-item">
          <span className="ceo-tower-funnel__swatch ceo-tower-funnel__swatch--amber" /> Vàng
        </span>
        {!hasIssues ? (
          <span className="ceo-tower-funnel__legend-item muted">Không có sót trong cửa sổ</span>
        ) : null}
      </div>
      <div className="ceo-tower-funnel__grid">
        {bars.map((bar) => {
          const active = activeColumnId === bar.columnId;
          const redPct =
            bar.totalIssues > 0 ? Math.round((bar.redCount / bar.totalIssues) * 100) : 0;
          const amberPct = bar.totalIssues > 0 ? 100 - redPct : 0;
          return (
            <button
              key={bar.columnId}
              type="button"
              data-testid={`ceo-tower-column-${bar.columnId}`}
              aria-pressed={active}
              className={[
                'ceo-tower-funnel__col',
                severityClass(bar.headerSeverity),
                active ? 'ceo-tower-funnel__col--active' : '',
                bar.isBottleneck ? 'ceo-tower-funnel__col--bottleneck' : '',
                bar.unusedLabel ? 'ceo-tower-funnel__col--unused' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onColumn(bar.columnId)}
            >
              <div className="ceo-tower-funnel__chart" aria-hidden="true">
                {bar.unusedLabel ? (
                  <div className="ceo-tower-funnel__unused">—</div>
                ) : bar.degraded ? (
                  <div className="ceo-tower-funnel__degraded">degraded</div>
                ) : (
                  <div
                    className="ceo-tower-funnel__stack"
                    style={{ height: `${bar.barHeightPct}%` }}
                  >
                    {bar.amberCount > 0 ? (
                      <span
                        className="ceo-tower-funnel__segment ceo-tower-funnel__segment--amber"
                        style={{ flexBasis: `${amberPct}%` }}
                      />
                    ) : null}
                    {bar.redCount > 0 ? (
                      <span
                        className="ceo-tower-funnel__segment ceo-tower-funnel__segment--red"
                        style={{ flexBasis: `${redPct}%` }}
                      />
                    ) : null}
                    {bar.totalIssues === 0 ? (
                      <span className="ceo-tower-funnel__segment ceo-tower-funnel__segment--ok" />
                    ) : null}
                  </div>
                )}
              </div>
              <div className="ceo-tower-funnel__meta">
                <strong className="ceo-tower-funnel__label">{bar.label}</strong>
                {bar.isBottleneck ? (
                  <span className="ceo-tower-funnel__bottleneck-badge">Nút thắt</span>
                ) : null}
                {bar.unusedLabel ? (
                  <span className="muted ceo-tower-funnel__counts">{bar.unusedLabel}</span>
                ) : bar.degraded ? null : (
                  <span className="ceo-tower-funnel__counts">
                    <span className="ceo-tower-funnel__count ceo-tower-funnel__count--red">
                      {bar.redCount}
                    </span>
                    <span className="ceo-tower-funnel__count-sep">·</span>
                    <span className="ceo-tower-funnel__count ceo-tower-funnel__count--amber">
                      {bar.amberCount}
                    </span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
