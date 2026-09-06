import { Injectable } from '@nestjs/common';
import type { RevopsTeamPerformanceRow, RevopsTeamStatus } from './revops.types';

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

function attainmentPct(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || target === 0) return null;
  return Math.round((actual / target) * 100);
}

function statusFromPct(pct: number | null): RevopsTeamStatus {
  if (pct == null) return 'Need attention';
  if (pct >= 110) return 'Accelerator';
  if (pct >= 90) return 'On track';
  if (pct >= 70) return 'Need attention';
  return 'At risk';
}

@Injectable()
export class RevopsTeamPerformanceService {
  fromKpiRows(rows: Array<Record<string, unknown>> | undefined): RevopsTeamPerformanceRow[] {
    if (!rows?.length) return [];
    return rows.map((row, idx) => {
      const actualVnd = num(row.actual_vnd ?? row.actualVnd);
      const targetVnd = num(row.target_vnd ?? row.targetVnd);
      const pct = attainmentPct(actualVnd, targetVnd);
      return {
        staffId: num(row.staff_id ?? row.staffId) ?? idx + 1,
        name: str(row.name, '—'),
        role: str(row.role),
        teamLabel: str(row.team_label ?? row.teamLabel),
        targetVnd,
        actualVnd,
        attainmentPct: pct,
        pipelineVnd: num(row.pipeline_vnd ?? row.pipelineVnd),
        leadActive: num(row.lead_active ?? row.leadActive) ?? 0,
        slaPct: num(row.sla_pct ?? row.slaPct),
        status: statusFromPct(pct),
      };
    });
  }

  teamRevenueFromRows(
    rows: RevopsTeamPerformanceRow[],
  ): Array<{ teamId: string; label: string; actualVnd: number | null; targetVnd: number | null }> {
    const byTeam = new Map<
      string,
      { teamId: string; label: string; actualVnd: number | null; targetVnd: number | null }
    >();
    for (const row of rows) {
      const key = row.teamLabel || String(row.staffId);
      const cur = byTeam.get(key) ?? {
        teamId: key,
        label: row.teamLabel || row.name,
        actualVnd: null,
        targetVnd: null,
      };
      if (row.actualVnd != null) cur.actualVnd = (cur.actualVnd ?? 0) + row.actualVnd;
      if (row.targetVnd != null) cur.targetVnd = (cur.targetVnd ?? 0) + row.targetVnd;
      byTeam.set(key, cur);
    }
    return [...byTeam.values()];
  }
}
