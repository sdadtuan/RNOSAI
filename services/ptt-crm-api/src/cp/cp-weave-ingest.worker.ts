import { Injectable, Logger } from '@nestjs/common';
import { createDiskWeaveStorage } from './cp-weave-ingest.util';
import { CpWeaveService } from './cp-weave.service';

@Injectable()
export class CpWeaveIngestWorker {
  private readonly logger = new Logger(CpWeaveIngestWorker.name);

  constructor(private readonly weave: CpWeaveService) {}

  async tick(root = process.env.WEAVE_EXPORT_PREFIX): Promise<number> {
    const ingestOn = String(process.env.PTT_WEAVE_INGEST ?? '').trim();
    if (ingestOn !== '1' && ingestOn.toLowerCase() !== 'true') return 0;
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
