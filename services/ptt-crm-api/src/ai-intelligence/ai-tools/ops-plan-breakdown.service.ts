import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { dueDateFromDays } from '../../service-lifecycle/svc-task-assignment.util';
import { OpsCrmContextRepository, OpsPlanWriteRow } from './ops-crm-context.repository';
import { OpsDraftWriteService } from './ops-draft-write.service';
import { OpsKpiTargetWriteService } from './ops-kpi-target-write.service';
import {
  DEFAULT_BREAKDOWN_ROLES,
  isPlanBreakdownRoleKey,
  PLAN_BREAKDOWN_ROLE_TEMPLATES,
  PlanBreakdownKpiTemplate,
  PlanBreakdownRoleKey,
  PlanBreakdownRoleTemplate,
} from './ops-plan-breakdown.templates';
import {
  OpsPlanBreakdownKpi,
  OpsPlanBreakdownMatrixLine,
  OpsPlanBreakdownMeta,
  OpsPlanBreakdownResult,
} from './ops-plan-breakdown.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function asBool(raw: unknown, defaultValue: boolean): boolean {
  if (raw === undefined || raw === null) return defaultValue;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return defaultValue;
}

function normalizeStatus(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

function corpusFromPlan(plan: OpsPlanWriteRow): string {
  const metricsText =
    typeof plan.success_metrics_json === 'string'
      ? plan.success_metrics_json
      : JSON.stringify(plan.success_metrics_json ?? '');
  return [plan.name, plan.objectives, plan.notes, metricsText].join('\n');
}

/**
 * Extract a numeric/boolean target only when an explicit value is adjacent to a parse key.
 * Never invent defaults — miss → null.
 */
export function parseKpiTargetFromCorpus(
  corpus: string,
  kpi: PlanBreakdownKpiTemplate,
): { target: number | string | boolean | null; matched: boolean } {
  const text = String(corpus ?? '');
  if (!text.trim()) return { target: null, matched: false };

  const keys = [kpi.name, ...(kpi.parseKeys ?? [])];
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // name: 12 | name = 12 | name 12% | name <48
    const numRe = new RegExp(
      `${escaped}\\s*[:=]?\\s*<?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*%?`,
      'i',
    );
    const numMatch = text.match(numRe);
    if (numMatch) {
      const raw = numMatch[1].replace(',', '.');
      const n = Number(raw);
      if (Number.isFinite(n)) return { target: n, matched: true };
    }
    if (kpi.unit === 'boolean') {
      const boolRe = new RegExp(`${escaped}\\s*[:=]?\\s*(true|false|yes|no|1|0)\\b`, 'i');
      const boolMatch = text.match(boolRe);
      if (boolMatch) {
        const v = boolMatch[1].toLowerCase();
        return {
          target: v === 'true' || v === 'yes' || v === '1',
          matched: true,
        };
      }
    }
  }

  // success_metrics_json array of { metric|name, target|value }
  try {
    const parsed = JSON.parse(
      typeof text === 'string' && text.trim().startsWith('[')
        ? text.slice(text.indexOf('['))
        : 'null',
    );
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (!row || typeof row !== 'object') continue;
        const label = String(
          (row as { metric?: unknown; name?: unknown; key?: unknown }).metric ??
            (row as { name?: unknown }).name ??
            (row as { key?: unknown }).key ??
            '',
        )
          .trim()
          .toLowerCase();
        if (!label) continue;
        const hit = keys.some((k) => label.includes(k.toLowerCase()) || k.toLowerCase().includes(label));
        if (!hit) continue;
        const raw =
          (row as { target?: unknown; value?: unknown }).target ??
          (row as { value?: unknown }).value;
        if (raw == null || raw === '') continue;
        if (typeof raw === 'boolean') return { target: raw, matched: true };
        const n = Number(raw);
        if (Number.isFinite(n)) return { target: n, matched: true };
        return { target: String(raw), matched: true };
      }
    }
  } catch {
    // ignore — fall through to null
  }

  return { target: null, matched: false };
}

function parseSuccessMetricsArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

@Injectable()
export class OpsPlanBreakdownService {
  constructor(
    private readonly repo: OpsCrmContextRepository,
    private readonly draftWrite: OpsDraftWriteService,
    private readonly kpiTargetWrite: OpsKpiTargetWriteService,
  ) {}

  async breakdownToRoles(
    input: Record<string, unknown>,
    meta: OpsPlanBreakdownMeta,
    opts: { humanApproved: boolean },
  ): Promise<OpsPlanBreakdownResult> {
    const planId = positiveInt(input.plan_id ?? input.planId);
    if (planId == null) {
      throw new BadRequestException({ error: 'plan_id_required' });
    }

    const persistTasks = asBool(input.persist_tasks ?? input.persistTasks, false);
    const persistKpis = asBool(input.persist_kpis ?? input.persistKpis, false);
    const allowReview = asBool(input.allow_review ?? input.allowReview, false);

    if ((persistTasks || persistKpis) && !opts.humanApproved) {
      throw new ForbiddenException({
        error: 'human_approval_required',
        tool_name: 'plan.breakdown_to_roles',
        message:
          'persist_tasks / persist_kpis require human approval (X-AI-Human-Approved: 1) per SRS P5.',
      });
    }

    const plan = await this.repo.getPlanForWrite(planId);
    if (!plan) {
      throw new NotFoundException({ error: 'plan_not_found', plan_id: planId });
    }

    const status = normalizeStatus(plan.status);
    if (status === 'active') {
      // allowed
    } else if (status === 'review' && allowReview) {
      // allowed
    } else {
      throw new ConflictException({
        error: 'plan_not_approved',
        plan_id: planId,
        plan_status: plan.status,
      });
    }

    const roles = this.resolveRoles(input.roles);
    const ownerMap = this.parseOwnerMap(input.owner_map ?? input.ownerMap);
    const dueInDays = positiveInt(input.due_in_days ?? input.dueInDays);

    const known: string[] = [`plan_status:${status}`, `roles:${roles.join(',')}`];
    const assumed: string[] = [];
    const unknown: string[] = [];

    if (dueInDays != null) {
      known.push(`due_in_days:${dueInDays}`);
    }

    const corpus = corpusFromPlan(plan);
    const metricsArr = parseSuccessMetricsArray(plan.success_metrics_json);
    const metricsCorpus =
      metricsArr != null ? `${corpus}\n${JSON.stringify(metricsArr)}` : corpus;

    const dueDate = dueInDays != null ? dueDateFromDays(dueInDays) : null;
    const matrix: OpsPlanBreakdownMatrixLine[] = [];
    let anyKpiParsed = false;

    for (const roleKey of roles) {
      const tpl = PLAN_BREAKDOWN_ROLE_TEMPLATES[roleKey];
      const line = this.buildLine(tpl, plan, metricsCorpus, ownerMap, dueDate);
      if (line.kpis.some((k) => k.target != null)) anyKpiParsed = true;
      matrix.push(line);
    }

    if (matrix.length === 0) {
      throw new UnprocessableEntityException({ error: 'empty_matrix', plan_id: planId });
    }

    if (!anyKpiParsed) {
      unknown.push('kpi_targets_numeric');
    } else {
      known.push('kpi_targets_parsed_partial_or_full');
    }

    for (const line of matrix) {
      for (const kpi of line.kpis) {
        if (kpi.target == null) {
          unknown.push(`${line.role_key}.${kpi.name}`);
        } else {
          known.push(`${line.role_key}.${kpi.name}=${String(kpi.target)}`);
        }
      }
    }

    const taskIds: number[] = [];
    const kpiTargetIds: number[] = [];
    const links = [`/crm/marketing-plan/${planId}`];

    let lifecycleIdForPersist: number | null =
      positiveInt(input.lifecycle_id ?? input.lifecycleId) ?? plan.lifecycle_id ?? null;

    if (persistTasks) {
      lifecycleIdForPersist = await this.resolveLifecycleForPersist(input, plan);
      for (const line of matrix) {
        const result = await this.draftWrite.createTaskDraft(
          {
            title: line.task_title,
            acceptance_criteria: line.acceptance_criteria,
            lifecycle_id: lifecycleIdForPersist,
            plan_id: planId,
            role_key: line.role_key,
            ...(line.owner_id ? { owner: line.owner_id } : {}),
            ...(line.due ? { due_date: line.due } : {}),
            priority: 'normal',
          },
          meta,
        );
        const taskId = Number(result.entity_ids.task_id);
        if (Number.isInteger(taskId) && taskId > 0) taskIds.push(taskId);
      }
      links.push(`/crm/service-delivery/${lifecycleIdForPersist}`);
      known.push(`tasks_persisted:${taskIds.length}`);
    }

    if (persistKpis) {
      const period = this.defaultPeriodFromPlan(plan);
      const items: Record<string, unknown>[] = [];
      for (const line of matrix) {
        for (const kpi of line.kpis) {
          const targetValue =
            typeof kpi.target === 'number'
              ? kpi.target
              : typeof kpi.target === 'boolean'
                ? kpi.target
                  ? 1
                  : 0
                : kpi.target == null
                  ? null
                  : Number.isFinite(Number(kpi.target))
                    ? Number(kpi.target)
                    : null;
          items.push({
            plan_id: planId,
            lifecycle_id: lifecycleIdForPersist,
            role_key: line.role_key,
            kpi_key: kpi.name,
            kpi_label: kpi.name.replace(/_/g, ' '),
            period_start: period.start,
            period_end: period.end,
            target_value: targetValue,
            target_unit: kpi.unit,
            owner_staff_id: line.owner_id,
            notes: `From plan.breakdown_to_roles matrix — ${line.role_label}`,
            upsert_key: `breakdown:${planId}:${line.role_key}:${kpi.name}`,
            breakdown_line_id: `${line.role_key}:${kpi.name}`,
          });
        }
      }
      if (items.length > 0) {
        const batch = await this.kpiTargetWrite.writeDraft(
          { plan_id: planId, items },
          meta,
          { humanApproved: true },
        );
        if ('kpi_target_ids' in batch) {
          kpiTargetIds.push(...batch.kpi_target_ids);
        } else {
          kpiTargetIds.push(batch.kpi_target_id);
        }
      }
      links.push(`/crm/kpi-hub/role-kpi?plan_id=${planId}`);
      known.push(`kpis_persisted:${kpiTargetIds.length}`);
    }

    return {
      ok: true,
      wired: true,
      phase: 'P5',
      plan_id: planId,
      plan_status: plan.status,
      persist_tasks: persistTasks,
      persist_kpis: persistKpis,
      matrix,
      task_ids: taskIds,
      kpi_target_ids: kpiTargetIds,
      known: [...new Set(known)],
      assumed: [...new Set(assumed)],
      unknown: [...new Set(unknown)],
      links: [...new Set(links)],
    };
  }

  private defaultPeriodFromPlan(_plan: OpsPlanWriteRow): { start: string; end: string } {
    const year = new Date().getFullYear();
    return { start: `${year}-10-01`, end: `${year}-12-31` };
  }

  private resolveRoles(raw: unknown): PlanBreakdownRoleKey[] {
    if (raw == null) return [...DEFAULT_BREAKDOWN_ROLES];
    const list = Array.isArray(raw) ? raw : [raw];
    const out: PlanBreakdownRoleKey[] = [];
    for (const item of list) {
      const key = String(item ?? '')
        .trim()
        .toLowerCase();
      if (isPlanBreakdownRoleKey(key) && !out.includes(key)) out.push(key);
    }
    return out;
  }

  private parseOwnerMap(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const id = String(v ?? '').trim();
      if (id) out[String(k).trim().toLowerCase()] = id;
    }
    return out;
  }

  private buildLine(
    tpl: PlanBreakdownRoleTemplate,
    plan: OpsPlanWriteRow,
    corpus: string,
    ownerMap: Record<string, string>,
    due: string | null,
  ): OpsPlanBreakdownMatrixLine {
    const kpis: OpsPlanBreakdownKpi[] = tpl.kpis.map((kpi) => {
      const parsed = parseKpiTargetFromCorpus(corpus, kpi);
      return {
        name: kpi.name,
        target: parsed.target,
        unit: kpi.unit,
      };
    });

    const planLabel = String(plan.name ?? '').trim() || `plan #${plan.id}`;
    return {
      role_key: tpl.role_key,
      role_label: tpl.role_label,
      kpis,
      deliverables: [...tpl.deliverables],
      task_title: `${tpl.task_title_suffix} — ${planLabel}`.slice(0, 400),
      acceptance_criteria: tpl.acceptance_criteria,
      owner_id: ownerMap[tpl.role_key] ?? null,
      due,
    };
  }

  private async resolveLifecycleForPersist(
    input: Record<string, unknown>,
    plan: OpsPlanWriteRow,
  ): Promise<number> {
    const explicit = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (explicit != null) return explicit;
    if (plan.lifecycle_id != null) return plan.lifecycle_id;
    throw new BadRequestException({
      error: 'lifecycle_required',
      message: 'persist_tasks requires lifecycle_id (or plan linked to a lifecycle)',
      plan_id: plan.id,
    });
  }
}
