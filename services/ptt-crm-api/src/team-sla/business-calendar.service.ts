import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { setBusinessCalendars, type BusinessCalendar } from '../leads-funnel/business-hours.util';
import { setSolutionClockSettings } from '../leads-funnel/team-sla-solution-settings';
import { LeadSlaSettingsService } from '../lead-sla-settings/lead-sla-settings.service';
import { composeBusinessCalendars, onBusinessCalendarSourceChanged } from './business-calendar.util';
import { TeamSlaService } from './team-sla.service';

const REFRESH_MS = 5 * 60 * 1000;

function describe(cal: BusinessCalendar): string {
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `days=${cal.days.join(',')} ${hhmm(cal.startMin)}-${hhmm(cal.endMin)} holidays=${cal.holidays.length}`;
}

/**
 * Loads the business calendar from the Admin "Lead First Response SLA" config (published lead-SLA
 * working hours + holidays, and the per-team calendars / Marketing Solution clocks) at startup,
 * reloads on publish / save, and every 5 minutes for other processes. Missing config keeps the
 * built-in T2–T6 08:30–18:30. Saved deadlines are never recomputed.
 */
@Injectable()
export class BusinessCalendarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BusinessCalendarService.name);
  private timer: NodeJS.Timeout | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastSummary = '';

  constructor(
    private readonly teamSla: TeamSlaService,
    private readonly leadSla: LeadSlaSettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.unsubscribe = onBusinessCalendarSourceChanged(() => {
      void this.refresh();
    });
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async refresh(): Promise<void> {
    try {
      const [payload, doc] = await Promise.all([
        this.leadSla.getPublishedPayload().catch(() => null),
        this.teamSla.getDocument().catch(() => null),
      ]);
      const snap = composeBusinessCalendars(payload, doc);
      setBusinessCalendars({ default: snap.default, groups: snap.groups });
      setSolutionClockSettings(snap.solution);
      const summary = [
        `default ${describe(snap.default)}`,
        ...Object.entries(snap.groups).map(([code, cal]) => `${code} ${describe(cal as BusinessCalendar)}`),
        `revision_hours=${snap.solution.revisionHours ?? 'default'}`,
      ].join(' | ');
      if (summary !== this.lastSummary) {
        this.lastSummary = summary;
        this.logger.log(`Business calendar loaded: ${summary}`);
      }
    } catch (err) {
      this.logger.warn(
        `Business calendar refresh failed, keeping the previous calendar: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
