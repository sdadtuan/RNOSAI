import { Injectable } from '@nestjs/common';
import type { RevopsActionItem, RevopsRiskItem } from './revops.types';

/**
 * W1: fail-soft empty lists. Stale-lead / AM renewal queries land in later waves.
 */
@Injectable()
export class RevopsActionsService {
  async todayQueue(): Promise<RevopsActionItem[]> {
    return [];
  }

  async atRisk(): Promise<RevopsRiskItem[]> {
    return [];
  }
}
