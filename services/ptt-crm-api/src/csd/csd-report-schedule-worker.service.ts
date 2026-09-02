import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CsdNotificationsRepository } from './csd-notifications.repository';
import { periodForRecurrence, tickCsdReportSchedules } from './csd-report-schedule.worker';
import { CsdReportsRepository } from './csd-reports.repository';
import { CsdReportsService } from './csd-reports.service';
import type { CsdActor, CsdReportScheduleRow } from './csd.types';

const TICK_MS = 5 * 60_000;

@Injectable()
export class CsdReportScheduleWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CsdReportScheduleWorkerService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly reports: CsdReportsService,
    private readonly repo: CsdReportsRepository,
    private readonly notifyRepo: CsdNotificationsRepository,
  ) {}

  onModuleInit(): void {
    if (process.env.PTT_CSD_REPORT_SCHEDULE_WORKER === '0') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<{ created: number }> {
    if (this.ticking) return { created: 0 };
    this.ticking = true;
    try {
      const result = await tickCsdReportSchedules({
        claimDue: (limit) => this.repo.claimDueSchedules(limit),
        createDraft: (schedule) => this.createDraft(schedule),
        notify: (staffId, reportId) => this.notifyOwner(staffId, reportId),
      });
      if (result.created) {
        this.logger.debug(`Report schedule tick created=${result.created}`);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`CSD report schedule tick failed: ${message}`);
      return { created: 0 };
    } finally {
      this.ticking = false;
    }
  }

  private async createDraft(schedule: CsdReportScheduleRow): Promise<{ id: string }> {
    const period = periodForRecurrence(schedule.recurrence);
    const actor: CsdActor = {
      staffId: schedule.owner_staff_id ?? 0,
      staffLabel: 'schedule-worker',
      caps: [],
    };
    const report = await this.reports.createReport(actor, {
      template_code: schedule.template_code,
      client_account_id: schedule.client_account_id ?? undefined,
      period_start: period.period_start,
      period_end: period.period_end,
    });
    return { id: report.id };
  }

  private async notifyOwner(staffId: number, reportId: string): Promise<void> {
    await this.notifyRepo.insert({
      staff_id: staffId,
      event_key: 'report_due',
      title_vi: 'Báo cáo đến hạn',
      body_vi: 'Đã tạo bản nháp báo cáo định kỳ. Chưa gửi cho khách.',
      entity_type: 'report',
      entity_id: reportId,
      severity: 'info',
    });
  }
}
