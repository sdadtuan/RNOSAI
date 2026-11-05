import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { QuoteSettingsRepository } from './quote-settings.repository';
import { tickQuoteExpiry } from './quote-expiry.worker';

const TICK_MS = 60_000;

@Injectable()
export class QuoteExpiryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuoteExpiryWorkerService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(private readonly db: QuoteSettingsRepository) {}

  onModuleInit(): void {
    if (process.env.PTT_QT_EXPIRY_WORKER === '0') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<{ expired: number }> {
    if (this.ticking) return { expired: 0 };
    this.ticking = true;
    try {
      const result = await tickQuoteExpiry(now, this.db);
      if (result.expired) {
        this.logger.debug(`Quote expiry tick expired=${result.expired}`);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Quote expiry tick failed: ${message}`);
      return { expired: 0 };
    } finally {
      this.ticking = false;
    }
  }
}
