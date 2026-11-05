'use client';

type Tile = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'critical' | 'warn' | 'ok';
};

type Props = {
  tiles: Tile[];
};

export function ServiceKpiSummaryTiles({ tiles }: Props) {
  return (
    <div className="kpi-hub-skpi-kpis">
      {tiles.map((tile) => (
        <article
          key={tile.label}
          className={`kpi-hub-skpi-kpi${
            tile.tone === 'critical'
              ? ' kpi-hub-skpi-kpi--critical'
              : tile.tone === 'warn'
                ? ' kpi-hub-skpi-kpi--warn'
                : tile.tone === 'ok'
                  ? ' kpi-hub-skpi-kpi--ok'
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
