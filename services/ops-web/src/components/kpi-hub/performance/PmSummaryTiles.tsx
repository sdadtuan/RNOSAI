'use client';

import type { ReactNode } from 'react';

export type PmTile = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'critical';
  variant?: 'default' | 'blocked';
};

type Props = {
  tiles: PmTile[];
  cols?: 4 | 5 | 6;
  className?: string;
};

export function PmSummaryTiles({ tiles, cols = 6, className }: Props) {
  return (
    <div className={`kpi-hub-pm-kpis kpi-hub-pm-kpis--${cols}${className ? ` ${className}` : ''}`}>
      {tiles.map((tile) => (
        <article
          key={tile.label}
          className={`kpi-hub-pm-kpi${
            tile.variant === 'blocked'
              ? ' kpi-hub-pm-tile-blocked'
              : tile.tone === 'critical'
                ? ' kpi-hub-pm-kpi--critical'
                : tile.tone === 'warn'
                  ? ' kpi-hub-pm-kpi--warn'
                  : tile.tone === 'ok'
                    ? ' kpi-hub-pm-kpi--ok'
                    : ''
          }`}
        >
          <label>{tile.label}</label>
          <b>{tile.value}</b>
          {tile.hint ? <span>{tile.hint}</span> : null}
        </article>
      ))}
    </div>
  );
}
