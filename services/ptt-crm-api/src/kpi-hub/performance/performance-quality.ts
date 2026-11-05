export type Quality = 'verified' | 'pending' | 'stale';

export function cascadeQuality(
  rows: Array<{ kpi: string; quality: Quality; dependents: string[] }>,
): Array<{ kpi: string; quality: Quality }> {
  const map = new Map(rows.map((r) => [r.kpi, r.quality]));
  for (const row of rows) {
    if (row.quality !== 'stale' && row.quality !== 'pending') continue;
    for (const dep of row.dependents) {
      if (map.get(dep) === 'verified') map.set(dep, 'pending');
    }
  }
  return [...map.entries()].map(([kpi, quality]) => ({ kpi, quality }));
}

export function canClosePeriod(rows: Array<{ quality: Quality }>): boolean {
  return rows.length > 0 && rows.every((r) => r.quality === 'verified');
}

export function canPublishClientReport(input: {
  quality: Quality;
  client_visible: boolean;
}): boolean {
  return input.client_visible && input.quality === 'verified';
}
