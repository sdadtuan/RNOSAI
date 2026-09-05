import { Injectable } from '@nestjs/common';
import { AmHealthService, type AmHealthRecomputeResult } from './am-health.service';

@Injectable()
export class AmHealthWorker {
  constructor(private readonly health: AmHealthService) {}
  run(opts?: { asOf?: string }): Promise<AmHealthRecomputeResult> {
    return this.health.recompute({ asOf: opts?.asOf });
  }
}
