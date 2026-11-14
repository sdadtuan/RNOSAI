import fs from 'fs';
import path from 'path';
import { SOLUTION_REVISION_HOURS, type SolutionWorkDueSettings } from './solution-case.util';

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
            revision_hours?: number | null;
          };
        }>;
      };
      const marketing = (raw.profiles ?? []).find((row) => row.code === 'marketing');
      if (!marketing?.marketing) continue;
      const clocks = marketing.marketing;
      const revision = Number(clocks.revision_hours);
      return {
        cutoffTime: clocks.solution_cutoff_time,
        beforeCutoffHours:
          clocks.solution_before_cutoff_hours == null
            ? undefined
            : Number(clocks.solution_before_cutoff_hours),
        afterCutoffTime: clocks.solution_after_cutoff_time,
        workStartTime: marketing.calendar?.start,
        revisionHours: Number.isFinite(revision) && revision > 0 ? revision : undefined,
      };
    } catch {
      /* try the next path */
    }
  }
  return {};
}

let loadedSolutionSettings: SolutionWorkDueSettings | null = null;

/** Installed by BusinessCalendarService from the saved team-SLA config. */
export function setSolutionClockSettings(settings: SolutionWorkDueSettings | null): void {
  loadedSolutionSettings = settings;
}

/** Marketing Solution clocks: loaded config first, else the local team-SLA file, else defaults. */
export function currentSolutionWorkSettings(): SolutionWorkDueSettings {
  return loadedSolutionSettings ?? loadMarketingSolutionWorkSettings();
}

/** "Hạn sửa Solutions (giờ)" from config; defaults to 2 business hours. */
export function solutionRevisionHours(settings: SolutionWorkDueSettings = currentSolutionWorkSettings()): number {
  const hours = Number(settings.revisionHours);
  return Number.isFinite(hours) && hours > 0 ? hours : SOLUTION_REVISION_HOURS;
}
