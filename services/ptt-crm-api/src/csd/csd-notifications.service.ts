import { Injectable, NotFoundException } from '@nestjs/common';
import { CsdNotificationsRepository } from './csd-notifications.repository';
import type { CsdNotificationRow } from './csd.types';

@Injectable()
export class CsdNotificationsService {
  constructor(private readonly repo: CsdNotificationsRepository) {}

  async list(staffId: number, unreadOnly = false): Promise<{ items: CsdNotificationRow[] }> {
    return { items: await this.repo.listForStaff(staffId, unreadOnly) };
  }

  async markRead(staffId: number, id: string): Promise<{ read: true }> {
    const ok = await this.repo.markRead(id, staffId);
    if (!ok) throw new NotFoundException({ error: 'csd_notification_not_found' });
    return { read: true };
  }
}
