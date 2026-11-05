import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import {
  KPI_HUB_ERROR_CODES,
  type CreateHubReportBody,
  type HubReportListQuery,
  type PaginatedMeta,
  type ScheduleHubReportBody,
  type ShareHubReportBody,
} from '../kpi-hub.types';

@Injectable()
export class KpiHubReportsService {
  private meta(page: number, pageSize: number, total: number): PaginatedMeta {
    return {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private summary() {
    return {
      total: kpiHubMemory.reports.length + 9,
      mine: kpiHubMemory.reports.filter((r) => r.owner.id === 101).length + 4,
      shared: 6,
      sent_this_month: 28,
    };
  }

  async list(query: HubReportListQuery) {
    return withDbFallback(async () => null, () => {
      let items = [...kpiHubMemory.reports];
      const tab = query.tab ?? 'all';
      if (tab === 'mine') items = items.filter((r) => r.owner.id === 101);
      if (tab === 'shared') items = items.filter((r) => r.shared_count > 0);
      if (tab === 'scheduled') items = items.filter((r) => r.schedule_cron);
      if (query.q) {
        const q = query.q.toLowerCase();
        items = items.filter((r) => r.name.toLowerCase().includes(q));
      }
      const page = Math.max(1, Number(query.page ?? 1) || 1);
      const pageSize = [20, 50, 100].includes(Number(query.page_size)) ? Number(query.page_size) : 20;
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        summary: this.summary(),
        quick_templates: [
          { type: 'MARKETING_WEEKLY', label: 'Marketing tuần', icon: 'chart-bar' },
          { type: 'SALES_PIPELINE', label: 'Sales Pipeline', icon: 'funnel' },
          { type: 'FINANCE', label: 'Finance Snapshot', icon: 'currency' },
          { type: 'EXECUTIVE', label: 'Ban điều hành', icon: 'briefcase' },
        ],
        upcoming_schedules: kpiHubMemory.reports
          .filter((r) => r.next_run_at)
          .map((r) => ({ id: r.id, name: r.name, next_run_at: r.next_run_at })),
        meta: this.meta(page, pageSize, items.length),
      };
    });
  }

  async create(body: CreateHubReportBody, staffId: number) {
    const row = {
      id: randomUUID(),
      name: body.name,
      type: body.type,
      scope: body.scope ?? 'Organization',
      status: 'DRAFT',
      owner: { id: staffId, name: 'Performance MKT' },
      last_generated_at: null,
      shared_count: 0,
      schedule_cron: null,
      next_run_at: null,
      row_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    kpiHubMemory.reports.push(row);
    return row;
  }

  async share(id: string, body: ShareHubReportBody) {
    const idx = kpiHubMemory.reports.findIndex((r) => r.id === id);
    if (idx < 0) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    kpiHubMemory.reports[idx].shared_count += (body.user_ids?.length ?? 0) + (body.team_ids?.length ?? 0) || 1;
    return {
      report_id: id,
      shared_with: body.user_ids ?? [],
      message: body.message ?? 'Đã chia sẻ báo cáo',
      shared_at: new Date().toISOString(),
    };
  }

  async schedule(id: string, body: ScheduleHubReportBody) {
    const idx = kpiHubMemory.reports.findIndex((r) => r.id === id);
    if (idx < 0) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    kpiHubMemory.reports[idx] = {
      ...kpiHubMemory.reports[idx],
      schedule_cron: body.cron,
      next_run_at: '2026-09-08T08:00:00+07:00',
    };
    return kpiHubMemory.reports[idx];
  }

  async send(id: string) {
    const report = kpiHubMemory.reports.find((r) => r.id === id);
    if (!report) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    const failedSource = kpiHubMemory.sources.find((s) => s.status === 'FAILED');
    if (failedSource) {
      return {
        report_id: id,
        status: 'BLOCKED',
        reason: `Nguồn ${failedSource.name} Failed — không gửi số bịa`,
      };
    }
    report.last_generated_at = new Date().toISOString();
    return {
      report_id: id,
      status: 'SENT',
      sent_at: report.last_generated_at,
      recipients: 8,
    };
  }
}

@Injectable()
export class KpiHubActivityService {
  async list() {
    return withDbFallback(async () => null, () => ({
      items: kpiHubMemory.activity,
      total: kpiHubMemory.activity.length,
    }));
  }
}
