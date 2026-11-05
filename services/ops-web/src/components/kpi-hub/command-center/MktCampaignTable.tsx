'use client';

import { useState } from 'react';
import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  marketing: NonNullable<CommandCenterResponse['marketing']>;
  testId?: string;
};

type Tab = 'campaign' | 'adset' | 'creative' | 'landing';

const TABS: { id: Tab; label: string; grainKey?: 'adset' | 'creative' | 'landing' }[] = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'adset', label: 'Ad Set', grainKey: 'adset' },
  { id: 'creative', label: 'Creative', grainKey: 'creative' },
  { id: 'landing', label: 'Landing Page', grainKey: 'landing' },
];

export function MktCampaignTable({ marketing, testId = 'mkt-campaigns' }: Props) {
  const [tab, setTab] = useState<Tab>('campaign');
  const activeTab = TABS.find((t) => t.id === tab)!;
  const hasGrain = tab === 'campaign' || (activeTab.grainKey ? marketing.grain[activeTab.grainKey] : false);
  const rows = tab === 'campaign' ? marketing.campaigns : [];

  return (
    <article className="kpi-hub-card cc-campaigns" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Hiệu quả theo Campaign</h2>
      </header>
      <div className="cc-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!hasGrain || rows.length === 0 ? (
        <p className="cc-empty">
          {tab === 'campaign' ? 'Chưa có dữ liệu campaign.' : `Chưa có breakdown ${activeTab.label}.`}
        </p>
      ) : (
        <div className="kpi-hub-table-wrap">
          <table className="kpi-hub-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Kênh</th>
                <th>Spend</th>
                <th>Raw</th>
                <th>Valid</th>
                <th>CPL</th>
                <th>MQL Rate</th>
                <th>MQL</th>
                <th>ROAS</th>
                <th>Target</th>
                <th>DQ%</th>
                <th>⋯</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  <td>{String(row.name ?? '—')}</td>
                  <td>{String(row.channel ?? '—')}</td>
                  <td>{row.spend != null ? String(row.spend) : '—'}</td>
                  <td>{row.raw != null ? String(row.raw) : '—'}</td>
                  <td>{row.valid != null ? String(row.valid) : '—'}</td>
                  <td>{row.cpl != null ? String(row.cpl) : '—'}</td>
                  <td>{row.mql_rate != null ? String(row.mql_rate) : '—'}</td>
                  <td>{row.mql != null ? String(row.mql) : '—'}</td>
                  <td>{row.roas != null ? String(row.roas) : '—'}</td>
                  <td>{row.target != null ? String(row.target) : '—'}</td>
                  <td>{row.dq_pct != null ? String(row.dq_pct) : '—'}</td>
                  <td>⋯</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
