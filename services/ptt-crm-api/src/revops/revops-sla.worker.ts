import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RevopsSlaService } from './revops-sla.service';

@Injectable()
export class RevopsSlaWorker {
  private readonly logger = new Logger(RevopsSlaWorker.name);

  constructor(private readonly sla: RevopsSlaService) {}

  @Cron('*/5 * * * *')
  async handleTick(): Promise<void> {
    try {
      const out = await this.sla.tick(new Date());
      if (out.processed > 0) {
        this.logger.log(
          `revops sla tick processed=${out.processed} warnings=${out.warnings} breaches=${out.breaches} reminders=${out.reminders} reassign=${out.reassignments}`,
        );
      }
    } catch (err) {
      this.logger.error('revops sla tick failed', err as Error);
    }
  }
}
