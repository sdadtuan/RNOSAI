import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KpiHubFactsService } from './kpi-hub-facts.service';

@Injectable()
export class KpiHubFactsScheduler {
  private readonly logger = new Logger(KpiHubFactsScheduler.name);

  constructor(private readonly facts: KpiHubFactsService) {}

  /** Daily 08:00 Asia/Ho_Chi_Minh */
  @Cron('0 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runDailyCompute(): Promise<void> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
      const result = await this.facts.computePeriod(period);
      this.logger.log(`KPI Hub fact compute ${period}: ${result.facts_written} facts`);
    } catch (err) {
      this.logger.error(`KPI Hub fact compute failed: ${String(err)}`);
    }
  }
}
