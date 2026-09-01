'use client';

import Link from 'next/link';
import type { TowerFinanceCell, TowerPayload } from '@/lib/crm/ceo-tower-api';

function formatFinanceValue(key: string, value: number | null): string {
  if (value == null) return '—';
  if (key === 'top1' || key === 'gm') return `${value}%`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  return String(value);
}

function kTileClass(status: string): string {
  if (status === 'red') return 'kpi-tile kpi-tile--critical';
  if (status === 'amber') return 'kpi-tile kpi-tile--warning';
  if (status === 'green') return 'kpi-tile kpi-tile--success';
  return 'kpi-tile';
}

function financeTileClass(cell: TowerFinanceCell): string {
  if (cell.status === 'red') return 'kpi-tile kpi-tile--critical';
  if (cell.status === 'amber') return 'kpi-tile kpi-tile--warning';
  if (cell.status === 'green') return 'kpi-tile kpi-tile--success';
  return 'kpi-tile';
}

export type CeoTowerMetricStripProps = {
  kStrip: TowerPayload['k_strip'] | undefined;
  financeStrip: TowerPayload['finance_strip'] | undefined;
};

export function CeoTowerMetricStrip({ kStrip, financeStrip }: CeoTowerMetricStripProps) {
  if (!kStrip?.length && !financeStrip?.length) return null;

  return (
    <div className="ceo-tower-metrics">
      {kStrip?.length ? (
        <div data-testid="ceo-tower-k-strip" aria-label="Chỉ số K" className="ceo-tower-metrics__group">
          <h3 className="ceo-tower-metrics__heading">Chu kỳ K</h3>
          <div className="kpi-tile-grid">
            {kStrip.map((item) => (
              <Link key={item.key} href={item.href} className="kpi-tile-link">
                <div className={kTileClass(item.status)}>
                  <p className="kpi-tile__label">{item.key.toUpperCase()}</p>
                  <p className="kpi-tile__value">{item.value != null ? item.value : '—'}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {financeStrip?.length ? (
        <div
          data-testid="ceo-tower-finance-strip"
          aria-label="Chỉ số tiền"
          className="ceo-tower-metrics__group"
        >
          <h3 className="ceo-tower-metrics__heading">Tiền &amp; hiệu suất</h3>
          <div className="kpi-tile-grid">
            {financeStrip.map((cell) => (
              <Link key={cell.key} href={cell.href} className="kpi-tile-link">
                <div className={financeTileClass(cell)}>
                  <p className="kpi-tile__label">{cell.label_vi}</p>
                  <p className="kpi-tile__value">{formatFinanceValue(cell.key, cell.value)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
