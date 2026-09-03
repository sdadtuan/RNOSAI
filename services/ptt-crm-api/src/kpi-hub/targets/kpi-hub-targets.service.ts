import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { deriveHubStatus } from '../kpi-hub-status';
import { kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import {
  KPI_HUB_ERROR_CODES,
  type HubPeriodTargetRow,
  type HubTargetListQuery,
  type PaginatedMeta,
  type PatchHubTargetBody,
  type UpsertHubTargetBody,
} from '../kpi-hub.types';

@Injectable()
export class KpiHubTargetsService {
  private meta(page: number, pageSize: number, total: number): PaginatedMeta {
    return {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private summary(targets: HubPeriodTargetRow[]) {
    const totalKpis = kpiHubMemory.dictionary.filter((d) => d.status === 'ACTIVE').length;
    return {
      total_kpis: totalKpis,
      with_target: targets.length,
      achieved_pct: Math.round(
        (targets.filter((t) => t.status === 'ACHIEVED').length / Math.max(targets.length, 1)) * 100,
      ),
      warning_count: targets.filter((t) => t.status === 'WARNING').length,
      critical_count: targets.filter((t) => t.status === 'CRITICAL').length,
    };
  }

  async list(query: HubTargetListQuery) {
    const period = query.period ?? '2026-09';
    return withDbFallback(async () => null, () => {
      let items = kpiHubMemory.targets.filter((t) => t.period === period);
      if (query.status) items = items.filter((t) => t.status === query.status);
      if (query.q) {
        const q = query.q.toLowerCase();
        items = items.filter(
          (t) => t.dictionary_code.toLowerCase().includes(q) || t.dictionary_name.toLowerCase().includes(q),
        );
      }
      const page = Math.max(1, Number(query.page ?? 1) || 1);
      const pageSize = [20, 50, 100].includes(Number(query.page_size)) ? Number(query.page_size) : 20;
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        summary: this.summary(items),
        meta: this.meta(page, pageSize, items.length),
        period,
      };
    });
  }

  async upsert(body: UpsertHubTargetBody) {
    const dict = kpiHubMemory.dictionary.find((d) => d.id === body.dictionary_id);
    if (!dict) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });

    const status = deriveHubStatus({
      direction: dict.direction,
      actual: null,
      target: body.target_value,
      warning: body.warning_value ?? null,
      critical: body.critical_value ?? null,
    });

    const existingIdx = kpiHubMemory.targets.findIndex(
      (t) => t.dictionary_id === body.dictionary_id && t.period === body.period,
    );

    const row: HubPeriodTargetRow = {
      id: existingIdx >= 0 ? kpiHubMemory.targets[existingIdx].id : randomUUID(),
      dictionary_id: dict.id,
      dictionary_code: dict.code,
      dictionary_name: dict.name,
      period: body.period,
      period_start: `${body.period}-01`,
      period_end: '2026-09-30',
      grain: 'MONTH',
      scope_type: body.scope_type ?? 'ORGANIZATION',
      scope_label: body.scope_label ?? 'Toàn tổ chức',
      direction: dict.direction,
      unit: dict.unit,
      target_value: body.target_value,
      warning_value: body.warning_value ?? null,
      critical_value: body.critical_value ?? null,
      actual_value: existingIdx >= 0 ? kpiHubMemory.targets[existingIdx].actual_value : null,
      status: existingIdx >= 0 ? kpiHubMemory.targets[existingIdx].status : status,
      trend_pct: existingIdx >= 0 ? kpiHubMemory.targets[existingIdx].trend_pct : null,
      alerts_enabled: body.alerts_enabled ?? true,
      row_version: existingIdx >= 0 ? kpiHubMemory.targets[existingIdx].row_version + 1 : 1,
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) kpiHubMemory.targets[existingIdx] = row;
    else kpiHubMemory.targets.push(row);

    return {
      ...row,
      alert_rule:
        body.alerts_enabled !== false
          ? {
              frequency_minutes: body.alert_frequency_minutes ?? 240,
              channels: body.alert_channels ?? ['EMAIL', 'TEAMS'],
            }
          : null,
    };
  }

  async patch(id: string, body: PatchHubTargetBody, rowVersion: number) {
    const idx = kpiHubMemory.targets.findIndex((t) => t.id === id);
    if (idx < 0) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    if (kpiHubMemory.targets[idx].row_version !== rowVersion) {
      throw new ConflictException({ error: KPI_HUB_ERROR_CODES.VERSION_CONFLICT });
    }
    const dict = kpiHubMemory.dictionary.find((d) => d.id === kpiHubMemory.targets[idx].dictionary_id);
    const merged = { ...kpiHubMemory.targets[idx], ...body, row_version: rowVersion + 1 };
    if (dict && merged.actual_value != null) {
      merged.status = deriveHubStatus({
        direction: dict.direction,
        actual: merged.actual_value,
        target: merged.target_value,
        warning: merged.warning_value,
        critical: merged.critical_value,
      });
    }
    merged.updated_at = new Date().toISOString();
    kpiHubMemory.targets[idx] = merged;
    return merged;
  }

  async history(id: string) {
    const target = kpiHubMemory.targets.find((t) => t.id === id);
    if (!target) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    return {
      target_id: id,
      dictionary_code: target.dictionary_code,
      entries: [
        {
          at: '2026-09-01T09:00:00+07:00',
          actor: 'Performance MKT',
          change: 'Thiết lập target 150.000 VND, warning 180.000, critical 220.000',
        },
        {
          at: '2026-08-28T14:00:00+07:00',
          actor: 'BI Admin',
          change: 'Sao chép từ template tháng 08/2026',
        },
      ],
    };
  }
}
