import fs from 'fs';
import path from 'path';
import type { SolutionWorkDueSettings } from './solution-case.util';

function candidatePaths(): string[] {
  const cwd = process.cwd();
  const extra = process.env.TEAM_SLA_PROFILES_PATH?.trim();
  return [
    extra || '',
    path.join(cwd, '../ops-web/.data/team-sla-profiles.json'),
    path.join(cwd, '../../ops-web/.data/team-sla-profiles.json'),
    path.join(cwd, 'services/ops-web/.data/team-sla-profiles.json'),
  ].filter(Boolean);
}

/** Read Marketing clocks from the local team-SLA file so the engine matches the admin UI. */
export function loadMarketingSolutionWorkSettings(): SolutionWorkDueSettings {
  for (const file of candidatePaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        profiles?: Array<{
          code?: string;
          calendar?: { start?: string };
          marketing?: {
            solution_cutoff_time?: string;
            solution_before_cutoff_hours?: number | null;
            solution_after_cutoff_time?: string;
          };
        }>;
      };
      const marketing = (raw.profiles ?? []).find((row) => row.code === 'marketing');
      if (!marketing?.marketing) continue;
      const clocks = marketing.marketing;
      return {
        cutoffTime: clocks.solution_cutoff_time,
        beforeCutoffHours:
          clocks.solution_before_cutoff_hours == null
            ? undefined
            : Number(clocks.solution_before_cutoff_hours),
        afterCutoffTime: clocks.solution_after_cutoff_time,
        workStartTime: marketing.calendar?.start,
      };
    } catch {
      /* try the next path */
    }
  }
  return {};
}
