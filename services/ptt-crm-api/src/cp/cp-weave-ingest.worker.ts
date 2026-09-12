import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createDiskWeaveStorage } from './cp-weave-ingest.util';
import { CpWeaveService } from './cp-weave.service';

const TICK_MS = 60_000;

@Injectable()
export class CpWeaveIngestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CpWeaveIngestWorker.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly weave: CpWeaveService) {}

  onModuleInit(): void {
    if (!isIngestOn()) return;
    this.timer = setInterval(() => {
      void this.tick().catch((error) => {
        this.logger.warn(`weave ingest tick failed: ${error instanceof Error ? error.message : error}`);
      });
    }, TICK_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  isWatching(): boolean {
    return this.timer != null;
  }

  async tick(root = process.env.WEAVE_EXPORT_PREFIX): Promise<number> {
    if (!isIngestOn()) return 0;
    if (!root) return 0;
    const storage = createDiskWeaveStorage(root);
    const keys = await storage.list('');
    let ingested = 0;
    for (const key of keys) {
      try {
        const result = await this.weave.ingestKey(key, storage);
        if (result === 'ingested') ingested += 1;
      } catch (error) {
        this.logger.warn(`ingest skip ${key}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return ingested;
  }
}

function isIngestOn(): boolean {
  const ingestOn = String(process.env.PTT_WEAVE_INGEST ?? '').trim().toLowerCase();
  return ingestOn === '1' || ingestOn === 'true';
}
