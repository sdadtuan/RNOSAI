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
import {
  resolveTarget,
  scopeHashFromChain,
  type HubScopeChain,
  type HubTargetCandidate,
} from './kpi-hub-target-resolver';

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

  private scopeChainFromQuery(query: HubTargetListQuery): HubScopeChain {
    return {
      campaign: query.campaign,
      team: query.team,
      department: query.department,
      user: query.user,
      project_id: query.project_id,
    };
  }

  private toCandidate(row: HubPeriodTargetRow): HubTargetCandidate {
    const level =
      (row.hierarchy_level as HubTargetCandidate['hierarchy_level']) ??
      (row.scope_type === 'PROJECT'
        ? 'PROJECT'
        : row.scope_type === 'ORGANIZATION'
          ? 'WORKSPACE'
          : row.scope_type === 'CAMPAIGN'
            ? 'CAMPAIGN'
            : 'TEAM');
    return {
      id: row.id,
      hierarchy_level: level,
      scope_hash:
        row.scope_hash ??
        scopeHashFromChain(
          level === 'PROJECT'
            ? { project_id: row.scope_label }
            : level === 'CAMPAIGN'
              ? { campaign: row.scope_label }
              : { team: row.scope_label },
        ),
      scope_label: row.scope_label,
      target_value: row.target_value,
      warning_value: row.warning_value,
      critical_value: row.critical_value,
      direction: row.direction,
    };
  }

  private resolveForDictionary(
    dictionaryId: string,
    period: string,
    scope: HubScopeChain,
  ): HubPeriodTargetRow | null {
    const candidates = kpiHubMemory.targets
      .filter((t) => t.dictionary_id === dictionaryId && t.period === period)
      .map((t) => this.toCandidate(t));
    const resolved = resolveTarget(candidates, scope);
    if (!resolved) return null;
    return kpiHubMemory.targets.find((t) => t.id === resolved.id) ?? null;
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
    const scope = this.scopeChainFromQuery(query);

    return withDbFallback(async () => null, () => {
      const grouped = new Map<string, HubPeriodTargetRow>();
      for (const t of kpiHubMemory.targets.filter((t) => t.period === period)) {
        const resolved = this.resolveForDictionary(t.dictionary_id, period, scope);
        if (resolved) grouped.set(resolved.dictionary_id, resolved);
      }
      let items = [...grouped.values()];

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
        scope_resolved: scope,
      };
    });
  }

  async upsert(body: UpsertHubTargetBody) {
    const dict = kpiHubMemory.dictionary.find((d) => d.id === body.dictionary_id);
    if (!dict) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });

    const hierarchyLevel =
      body.scope_type === 'PROJECT'
        ? 'PROJECT'
        : body.scope_type === 'CAMPAIGN'
          ? 'CAMPAIGN'
          : body.scope_type === 'TEAM'
            ? 'TEAM'
            : 'WORKSPACE';
    const scopeHash = scopeHashFromChain({
      project_id:
        hierarchyLevel === 'PROJECT' ? (body.scope_project_id ?? body.scope_label) : undefined,
      campaign: hierarchyLevel === 'CAMPAIGN' ? body.scope_label : undefined,
      team: hierarchyLevel === 'TEAM' ? body.scope_label : undefined,
    });

    const status = deriveHubStatus({
      direction: dict.direction,
      actual: null,
      target: body.target_value,
      warning: body.warning_value ?? null,
      critical: body.critical_value ?? null,
    });

    const existingIdx = kpiHubMemory.targets.findIndex(
      (t) =>
        t.dictionary_id === body.dictionary_id &&
        t.period === body.period &&
        (t.scope_hash ?? '') === scopeHash,
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
      scope_label:
        hierarchyLevel === 'PROJECT'
          ? (body.scope_project_id ?? body.scope_label ?? 'Project')
          : (body.scope_label ?? 'Toàn tổ chức'),
      hierarchy_level: hierarchyLevel,
      scope_hash: scopeHash,
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

  resolveTarget(dictionaryId: string, period: string, scope: HubScopeChain) {
    return this.resolveForDictionary(dictionaryId, period, scope);
  }
}
