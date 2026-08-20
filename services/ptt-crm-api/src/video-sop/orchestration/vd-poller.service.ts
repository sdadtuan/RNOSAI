import { Injectable } from '@nestjs/common';

/** S2: handlers drain via dispatcher `setImmediate`; poller is a no-op placeholder. */
@Injectable()
export class VdPollerService {
  tick(): void {
    /* no-op */
  }
}
