import { Injectable } from '@nestjs/common';
import type { AlertSeverity } from './b2b-alert.util';

@Injectable()
export class B2bStaffPushSender {
  async send(_input: {
    staffId: number;
    title: string;
    severity: AlertSeverity;
  }): Promise<void> {
    // Staff FCM not wired in v1 — persist alerts only; push hook for P5 PWA.
  }
}
