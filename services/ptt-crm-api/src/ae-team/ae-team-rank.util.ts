export interface AeRankInput {
  staffId: number;
  name: string;
  slaPct: number | null;
  callPct: number | null;
  conversionPct: number | null;
  revenuePct: number | null;
}

export interface AeRankRow {
  rank: number;
  staff_id: number;
  name: string;
  score: number | null;
  sla_pct: number | null;
  call_pct: number | null;
  conversion_pct: number | null;
  revenue_pct: number | null;
}

export function rankAeMembers(
  rows: AeRankInput[],
  weights: { sla: number; calls: number; conversion: number; revenue: number },
): AeRankRow[] {
  const scored = rows.map((row) => {
    const parts: Array<{ weight: number; value: number }> = [];
    if (row.slaPct != null) parts.push({ weight: weights.sla, value: row.slaPct });
    if (row.callPct != null) parts.push({ weight: weights.calls, value: row.callPct });
    if (row.conversionPct != null) parts.push({ weight: weights.conversion, value: row.conversionPct });
    if (row.revenuePct != null) parts.push({ weight: weights.revenue, value: row.revenuePct });
    const sum = parts.reduce((total, part) => total + part.weight, 0);
    const score = sum > 0 ? Math.round(parts.reduce((total, part) => total + (part.weight / sum) * part.value, 0) * 100) / 100 : null;
    return {
      rank: 0,
      staff_id: row.staffId,
      name: row.name,
      score,
      sla_pct: row.slaPct,
      call_pct: row.callPct,
      conversion_pct: row.conversionPct,
      revenue_pct: row.revenuePct,
    };
  });
  scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name, 'vi'));
  return scored.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function rankingToCsv(rows: AeRankRow[]): string {
  const header = ['Hạng', 'AE', 'Điểm', '% đúng SLA', '% nghe máy', '% chốt', '% chỉ tiêu'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      row.rank,
      csvCell(row.name),
      csvCell(row.score),
      csvCell(row.sla_pct),
      csvCell(row.call_pct),
      csvCell(row.conversion_pct),
      csvCell(row.revenue_pct),
    ].join(','));
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

function csvCell(value: string | number | null): string {
  if (value == null) return '';
  const text = String(value);
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}
