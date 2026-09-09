import React from 'react';

export function PmQualityChip({ quality }: { quality: string }) {
  const q = quality.toLowerCase();
  const label = q === 'verified' ? 'Verified' : q === 'stale' ? 'Stale' : 'Pending';
  const cls =
    q === 'verified'
      ? 'kpi-hub-badge kpi-hub-badge--pass'
      : 'kpi-hub-badge kpi-hub-badge--amber';
  return <span className={cls}>{label}</span>;
}
