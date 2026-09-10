'use client';

import { KPI_TILES, type CpKpiKey } from '@/lib/crm/cp-format';

export type CpTile = {
  key: CpKpiKey;
  label: string;
  value: string;
  trend?: { dir: 'up' | 'dn'; hint: string };
};

type CpSummaryTilesProps = {
  tiles: CpTile[];
};

export function CpSummaryTiles({ tiles }: CpSummaryTilesProps) {
  return (
    <div className="cp-tiles" aria-label="KPI tổng quan">
      {tiles.map((tile) => (
        <article key={tile.key} className="cp-tile">
          <span>{tile.label}</span>
          <strong>{tile.value}</strong>
          {tile.trend ? (
            <em className={tile.trend.dir === 'up' ? 'cp-up' : 'cp-dn'}>{tile.trend.hint}</em>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function kpiTilesFromRecord(
  kpis: Record<CpKpiKey, number | null>,
  format: (key: CpKpiKey, value: number | null) => string,
): CpTile[] {
  return KPI_TILES.map((tile) => ({
    key: tile.key,
    label: tile.label,
    value: format(tile.key, kpis[tile.key]),
  }));
}
