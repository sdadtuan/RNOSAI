import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CsdNotificationsRepository } from '../csd/csd-notifications.repository';
import { IwrLeaveAdapter } from './iwr-leave.adapter';
import { IwrReportsRepository } from './iwr-reports.repository';
import { tickIwrSchedules } from './iwr-schedule.worker';
import { IwrScheduleRepository } from './iwr-w4.repository';

const TICK_MS = 5 * 60_000;

@Injectable()
export class IwrScheduleWorkerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly schedules: IwrScheduleRepository,
    private readonly reports: IwrReportsRepository,
    private readonly leave: IwrLeaveAdapter,
    private readonly notify: CsdNotificationsRepository,
  ) {}

  onModuleInit(): void {
    if (process.env.PTT_IWR_SCHEDULE_WORKER === '0') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<{ ran: number }> {
    if (this.ticking) return { ran: 0 };
    this.ticking = true;
    try {
      return await tickIwrSchedules(
        {
          claimDue: (limit) => this.schedules.claimDueSchedules(limit),
          tryJob: (key, kind, payload) => this.schedules.tryInsertJob(key, kind, payload),
          isOnLeave: (staffId, ymd) => this.leave.isOnLeave(staffId, ymd),
          listStaff: () => this.schedules.listActiveStaffWithManager(),
          getDailyTemplateId: () => this.schedules.getDailyTemplateId(),
          findDailyDraft: (authorId, ymd) => this.schedules.findDailyDraft(authorId, ymd),
          createDailyDraft: (input) => this.schedules.insertDraftDaily(input),
          notify: async (staffId, _eventKey, title, body, entityId) => {
            await this.notify.insert({
              staff_id: staffId,
              event_key: _eventKey,
              title_vi: title,
              body_vi: body,
              entity_type: 'iwr_report',
              entity_id: entityId,
              severity: 'info',
            });
          },
          waiveDraft: async (reportId, staffId) => {
            await this.reports.updateStatus(reportId, {
              status: 'waived',
              waived_at: now.toISOString(),
              waived_by_staff_id: staffId,
              waive_reason: 'hr_leave',
            });
          },
          listManagers: () => this.schedules.listManagers(),
          leaderDigest: (leaderId, ymd) => this.schedules.leaderDigestCounts(leaderId, ymd),
        },
        now,
      );
    } finally {
      this.ticking = false;
    }
  }
}

@Injectable()
export class IwrSchedulesService {
  constructor(private readonly schedules: IwrScheduleRepository) {}

  async list(): Promise<{ items: import('./iwr.types').IwrScheduleRow[] }> {
    return { items: await this.schedules.listSchedules() };
  }
}
