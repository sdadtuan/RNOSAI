import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CsdEmailService } from './csd-email.service';

const POLL_MS = 5 * 60 * 1000;

@Injectable()
export class CsdEmailSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CsdEmailSyncWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly email: CsdEmailService) {}

  onModuleInit(): void {
    if ((process.env.PTT_CSD_EMAIL_SYNC ?? '0').trim() !== '1') return;
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    this.logger.log('CSD email sync worker started (5min poll)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async poll(): Promise<void> {
    this.logger.debug('CSD email sync poll — IMAP stub (no-op until mailbox configured)');
  }
}
