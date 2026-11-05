import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { kpiHubMemory } from '../kpi-hub.memory-store';
import { KPI_HUB_ERROR_CODES, type HubNotificationListQuery, type HubNotificationRow, type PaginatedMeta } from '../kpi-hub.types';
import { KpiHubNotificationsRepository } from './kpi-hub-notifications.repository';

type EmailLikeService = {
  send?: (input: { to: string; subject: string; body: string }) => Promise<unknown>;
};

@Injectable()
export class KpiHubNotificationsService {
  private readonly logger = new Logger(KpiHubNotificationsService.name);

  constructor(
    private readonly repo: KpiHubNotificationsRepository,
    @Optional() private readonly emailService?: EmailLikeService,
  ) {}

  private meta(page: number, pageSize: number, total: number): PaginatedMeta {
    return {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async list(staffId: number, query: HubNotificationListQuery) {
    const unreadOnly = query.unread_only === 'true' || query.unread_only === '1';
    const items = await this.repo.list(staffId, unreadOnly);
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = [20, 50, 100].includes(Number(query.page_size)) ? Number(query.page_size) : 20;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      unread_count: items.filter((n) => !n.read_at).length,
      meta: this.meta(page, pageSize, items.length),
    };
  }

  async markRead(id: string, staffId: number) {
    const row = await this.repo.markRead(id, staffId);
    if (!row) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    return row;
  }

  async notify(input: {
    staff_id: number;
    level: HubNotificationRow['level'];
    title: string;
    body?: string;
    link?: string;
    email?: string;
  }): Promise<HubNotificationRow> {
    const row = await this.repo.create({
      staff_id: input.staff_id,
      level: input.level,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });

    kpiHubMemory.activity.unshift({
      id: `act-${Date.now()}`,
      action: 'NOTIFICATION',
      entity_type: 'notification',
      entity_label: input.title,
      actor_name: 'Hệ thống',
      created_at: new Date().toISOString(),
    });

    if (input.email && this.emailService?.send) {
      try {
        await this.emailService.send({
          to: input.email,
          subject: input.title,
          body: input.body ?? input.title,
        });
      } catch (err) {
        this.logger.warn(`Email stub failed: ${String(err)}`);
      }
    } else if (input.email) {
      this.logger.log(`KPI Hub email stub: to=${input.email} subject=${input.title}`);
    }

    return row;
  }
}
