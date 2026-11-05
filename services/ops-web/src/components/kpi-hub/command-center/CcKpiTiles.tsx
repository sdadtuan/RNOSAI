'use client';

import type { CommandTile } from '@/lib/command-center-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  tiles: CommandTile[];
  loading?: boolean;
  testIdPrefix: string;
  weightedBadge?: 'weighted' | 'unweighted';
  onSelect?: (tile: CommandTile) => void;
};

function TileSkeleton() {
  return (
    <article className="kpi-hub-card kpi-hub-dash-card cc-tile cc-tile--skeleton">
      <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--sm" />
      <div className="kpi-hub-skeleton kpi-hub-skeleton--line kpi-hub-skeleton--lg" />
    </article>
  );
}

function sparklinePoints(values: number[]): string {
  if (values.length < 2) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 80;
      const y = 22 - ((v - min) / range) * 18;
      return `${x},${y}`;
    })
    .join(' ');
}

function perfLabel(status: string): string | undefined {
  if (status === 'DATA_ISSUE') return 'Lỗi dữ liệu';
  if (status === 'WARNING') return 'Thiếu';
  return undefined;
}

export function CcKpiTiles({ tiles, loading, testIdPrefix, weightedBadge, onSelect }: Props) {
  if (loading) {
    return (
      <div className="cc-tiles" data-testid={`${testIdPrefix}-kpi-tiles`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TileSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="cc-tiles" data-testid={`${testIdPrefix}-kpi-tiles`}>
      {tiles.map((tile) => {
        const points = sparklinePoints(tile.sparkline);
        const showUnweighted = tile.code === 'SAL_005W' && weightedBadge === 'unweighted';
        return (
          <article
            key={tile.code}
            className="kpi-hub-card kpi-hub-dash-card cc-tile kpi-hub-dash-card--clickable"
            onClick={() => onSelect?.(tile)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(tile);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <header className="kpi-hub-dash-card__head">
              <span className="kpi-hub-dash-card__code">{tile.code}</span>
              <div className="cc-tile__badges">
                <KpiHubStatusBadge kind="perf" status={tile.status} label={perfLabel(tile.status)} />
                {tile.freshness ? (
                  <KpiHubStatusBadge kind="freshness" status={tile.freshness} />
                ) : null}
              </div>
            </header>
            <p className="kpi-hub-dash-card__name">{tile.name}</p>
            <p className="kpi-hub-dash-card__value">{tile.formatted}</p>
            {tile.delta_pct != null ? (
              <p className={`kpi-hub-dash-card__delta${tile.delta_pct >= 0 ? ' is-up' : ' is-down'}`}>
                {tile.delta_pct >= 0 ? '+' : ''}
                {tile.delta_pct}% so với kỳ trước
              </p>
            ) : null}
            {showUnweighted ? (
              <span className="cc-tile__hint">chưa trọng số</span>
            ) : null}
            {points ? (
              <div className="kpi-hub-sparkline" aria-hidden>
                <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                  <polyline points={points} fill="none" stroke="#17692f" strokeWidth="2" />
                </svg>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
