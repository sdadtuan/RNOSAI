import { Injectable, NotFoundException } from '@nestjs/common';
import { kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import { KPI_HUB_ERROR_CODES, type HubAlertListQuery, type PaginatedMeta } from '../kpi-hub.types';

@Injectable()
export class KpiHubAlertsService {
  private meta(page: number, pageSize: number, total: number): PaginatedMeta {
    return {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async list(query: HubAlertListQuery) {
    return withDbFallback(async () => null, () => {
      let items = [...kpiHubMemory.alerts];
      if (query.status) items = items.filter((a) => a.status === query.status);
      if (query.level) items = items.filter((a) => a.level === query.level);
      const page = Math.max(1, Number(query.page ?? 1) || 1);
      const pageSize = [20, 50, 100].includes(Number(query.page_size)) ? Number(query.page_size) : 20;
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        meta: this.meta(page, pageSize, items.length),
      };
    });
  }

  async ack(id: string, staffId: number) {
    const idx = kpiHubMemory.alerts.findIndex((a) => a.id === id);
    if (idx < 0) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    kpiHubMemory.alerts[idx] = {
      ...kpiHubMemory.alerts[idx],
      status: 'ACK',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: staffId,
    };
    return kpiHubMemory.alerts[idx];
  }
}
