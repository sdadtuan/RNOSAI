import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidStage } from '../../service-lifecycle/service-lifecycle.types';
import { OpsCrmContextRepository } from './ops-crm-context.repository';
import { OpsDraftWriteMeta, OpsDraftWriteResult } from './ops-draft-write.types';

const EDITABLE_PLAN_STATUSES = new Set(['draft', 'review']);
const AI_TITLE_PREFIX = '[AI draft] ';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function optionalStr(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s ? s : undefined;
}

function auditBlock(meta: OpsDraftWriteMeta, sourceTool: string) {
  return {
    ai_approved_by: meta.actor,
    ai_approved_at: meta.approvedAt,
    source_tool: sourceTool,
  };
}

function appendAuditNote(notes: string, meta: OpsDraftWriteMeta): string {
  const line = `[AI draft approved by ${meta.actor} at ${meta.approvedAt}]`;
  const base = String(notes ?? '').trim();
  if (!base) return line;
  if (base.includes(line)) return base;
  return `${base}\n${line}`.slice(0, 32000);
}

@Injectable()
export class OpsDraftWriteService {
  constructor(private readonly repo: OpsCrmContextRepository) {}

  async writeMarketingPlanDraft(
    input: Record<string, unknown>,
    meta: OpsDraftWriteMeta,
  ): Promise<OpsDraftWriteResult> {
    const planId = positiveInt(input.plan_id ?? input.planId);
    const clone = Boolean(input.clone_to_draft ?? input.cloneToDraft);
    const name = String(input.title ?? input.name ?? '').trim();
    const period = optionalStr(input.period ?? input.period_label);
    const objectives = optionalStr(input.objectives);
    const notesIn = optionalStr(input.notes);

    if (planId != null) {
      const plan = await this.repo.getPlanForWrite(planId);
      if (!plan) {
        throw new NotFoundException({ error: 'plan_not_found', plan_id: planId });
      }

      if (EDITABLE_PLAN_STATUSES.has(plan.status)) {
        const updated = await this.repo.patchPlanDraft(planId, {
          ...(name ? { name } : {}),
          ...(period != null ? { period_label: period } : {}),
          ...(objectives != null ? { objectives } : {}),
          notes: appendAuditNote(notesIn ?? plan.notes, meta),
          strategy_framework_json: {
            ai_draft: auditBlock(meta, 'marketing_plan.write_draft'),
          },
        });
        return this.planResult(updated!.id);
      }

      if (!clone) {
        throw new ConflictException({
          error: 'plan_not_editable',
          plan_id: planId,
          status: plan.status,
        });
      }

      const cloned = await this.repo.clonePlanToDraft(planId, {
        ...(name ? { name } : {}),
        ...(period != null ? { period_label: period } : {}),
        ...(objectives != null ? { objectives } : {}),
        notes: appendAuditNote(notesIn ?? plan.notes, meta),
        strategy_framework_json: {
          ai_draft: auditBlock(meta, 'marketing_plan.write_draft'),
        },
      });
      return this.planResult(cloned.id);
    }

    if (!name) {
      throw new BadRequestException({ error: 'title_required' });
    }

    const lifecycleId = await this.resolveLifecycleId(input);
    const created = await this.repo.insertPlanDraft({
      name,
      period_label: period ?? '',
      objectives: objectives ?? '',
      notes: appendAuditNote(notesIn ?? '', meta),
      lifecycle_id: lifecycleId,
      strategy_framework_json: {
        ai_draft: auditBlock(meta, 'marketing_plan.write_draft'),
      },
    });
    return this.planResult(created.id);
  }

  async createTaskDraft(
    input: Record<string, unknown>,
    meta: OpsDraftWriteMeta,
  ): Promise<OpsDraftWriteResult> {
    const titleRaw = String(input.title ?? '').trim();
    if (!titleRaw) {
      throw new BadRequestException({ error: 'title_required' });
    }

    const lifecycleId = await this.resolveLifecycleId(input);
    if (lifecycleId == null) {
      throw new BadRequestException({ error: 'lifecycle_required' });
    }

    const lc = await this.repo.getLifecycle(lifecycleId);
    if (!lc) {
      throw new BadRequestException({ error: 'lifecycle_required' });
    }

    const stage = isValidStage(lc.stage) ? lc.stage : 'deliver';
    const title = titleRaw.startsWith(AI_TITLE_PREFIX)
      ? titleRaw
      : `${AI_TITLE_PREFIX}${titleRaw}`;

    const planId = positiveInt(input.plan_id ?? input.planId);
    const formData: Record<string, unknown> = {
      ai_draft: true,
      ai_approved_by: meta.actor,
      ai_approved_at: meta.approvedAt,
    };
    if (planId != null) formData.plan_id = planId;
    if (input.campaign_id != null && String(input.campaign_id).trim()) {
      formData.campaign_id = input.campaign_id;
    }

    const task = await this.repo.insertAiDraftTask({
      lifecycle_id: lifecycleId,
      stage,
      title,
      description: String(input.acceptance_criteria ?? '').slice(0, 4000),
      form_data: formData,
    });

    return {
      ok: true,
      wired: true,
      phase: 'P3',
      status: 'persisted',
      tool: 'task.create_draft',
      requires_human_approval: true,
      human_approved: true,
      entity_ids: { task_id: task.id, lifecycle_id: lifecycleId },
      links: [`/crm/service-delivery/${lifecycleId}`],
    };
  }

  private planResult(planId: number): OpsDraftWriteResult {
    return {
      ok: true,
      wired: true,
      phase: 'P3',
      status: 'persisted',
      tool: 'marketing_plan.write_draft',
      requires_human_approval: true,
      human_approved: true,
      entity_ids: { plan_id: planId },
      links: [`/crm/marketing-plan/${planId}`],
    };
  }

  private async resolveLifecycleId(
    input: Record<string, unknown>,
  ): Promise<number | null> {
    const explicit = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (explicit != null) return explicit;

    const planId = positiveInt(input.plan_id ?? input.planId);
    if (planId != null) {
      const plan = await this.repo.getPlan(planId);
      if (plan?.lifecycle_id) return plan.lifecycle_id;
    }

    const projectId = String(input.project_id ?? input.projectId ?? '').trim();
    if (projectId) {
      const project = await this.repo.getProject(projectId);
      if (project?.lifecycle_id) return project.lifecycle_id;
    }

    const clientId = String(input.client_id ?? input.clientId ?? '').trim();
    if (clientId) {
      const lc = await this.repo.findPrimaryLifecycleByClient(clientId);
      if (lc) return lc.id;
    }

    return null;
  }
}
