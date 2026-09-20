import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidStage } from '../../service-lifecycle/service-lifecycle.types';
import {
  dueDateFromDays,
  mergeAssignmentIntoFormData,
} from '../../service-lifecycle/svc-task-assignment.util';
import { OpsCrmContextRepository } from './ops-crm-context.repository';
import { OpsDraftWriteMeta, OpsDraftWriteResult } from './ops-draft-write.types';
import { OpsPresalesContextService } from './ops-presales-context.service';
import {
  isResearchOrTmmtStyleTask,
  isScaleAdsStyleTask,
  winningPlanGateFailedBody,
} from './ops-winning-plan-gate.util';

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

function assignmentPatchFromInput(input: Record<string, unknown>): {
  assignee?: string | null;
  owner?: string | null;
  assignee_staff_id?: number | null;
  priority?: string | null;
  due_date?: string | null;
} {
  const out: {
    assignee?: string | null;
    owner?: string | null;
    assignee_staff_id?: number | null;
    priority?: string | null;
    due_date?: string | null;
  } = {};

  if (input.assignee !== undefined) {
    out.assignee =
      input.assignee == null ? null : String(input.assignee).trim() || null;
  }
  if (input.owner !== undefined) {
    out.owner = input.owner == null ? null : String(input.owner).trim() || null;
  }
  if (input.assignee_staff_id !== undefined || input.owner_staff_id !== undefined) {
    const raw = input.assignee_staff_id ?? input.owner_staff_id;
    out.assignee_staff_id = raw == null || raw === '' ? null : positiveInt(raw) ?? null;
  }
  if (input.priority !== undefined) {
    out.priority =
      input.priority == null ? null : String(input.priority).trim() || null;
  }

  const dueInDays = positiveInt(input.due_in_days ?? input.dueInDays);
  if (dueInDays != null) {
    out.due_date = dueDateFromDays(dueInDays);
  } else if (input.due_date !== undefined || input.due !== undefined) {
    const raw = input.due_date !== undefined ? input.due_date : input.due;
    out.due_date = raw == null || raw === '' ? null : String(raw);
  }

  return out;
}

@Injectable()
export class OpsDraftWriteService {
  constructor(
    private readonly repo: OpsCrmContextRepository,
    private readonly presalesContext: OpsPresalesContextService,
  ) {}

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

    const lifecycleId = await this.resolveLifecycleIdForTask(input);

    const lc = await this.repo.getLifecycle(lifecycleId);
    if (!lc) {
      throw new BadRequestException({ error: 'lifecycle_required' });
    }

    const tags = Array.isArray(input.tags)
      ? input.tags.map((t) => String(t))
      : String(input.tag ?? input.tags ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
    if (isScaleAdsStyleTask(titleRaw, tags) && !isResearchOrTmmtStyleTask(titleRaw, tags)) {
      const gate = await this.presalesContext.evaluateGateForIds({
        lifecycle_id: lifecycleId,
        plan_id: positiveInt(input.plan_id ?? input.planId) ?? null,
        client_id: optionalStr(input.client_id ?? input.clientId) ?? null,
      });
      if (!gate.pass) {
        throw new ConflictException(winningPlanGateFailedBody(gate));
      }
    }

    const stage = isValidStage(lc.stage) ? lc.stage : 'deliver';
    const title = titleRaw.startsWith(AI_TITLE_PREFIX)
      ? titleRaw
      : `${AI_TITLE_PREFIX}${titleRaw}`;

    const planId = positiveInt(input.plan_id ?? input.planId);
    const roleKey = optionalStr(input.role_key ?? input.roleKey);
    let formData: Record<string, unknown> = {
      ai_draft: true,
      ai_approved_by: meta.actor,
      ai_approved_at: meta.approvedAt,
    };
    if (planId != null) formData.plan_id = planId;
    if (roleKey) formData.role_key = roleKey;
    if (input.campaign_id != null && String(input.campaign_id).trim()) {
      formData.campaign_id = input.campaign_id;
    }
    formData = mergeAssignmentIntoFormData(formData, assignmentPatchFromInput(input));

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

  async updateTaskDraft(
    input: Record<string, unknown>,
    meta: OpsDraftWriteMeta,
  ): Promise<OpsDraftWriteResult> {
    const taskId = positiveInt(input.task_id ?? input.taskId);
    if (taskId == null) {
      throw new BadRequestException({ error: 'task_id_required' });
    }

    const existing = await this.repo.getAiDraftTaskForWrite(taskId);
    if (!existing) {
      throw new NotFoundException({ error: 'task_not_found', task_id: taskId });
    }

    const titleIn = optionalStr(input.title);
    const criteriaIn =
      input.acceptance_criteria !== undefined
        ? String(input.acceptance_criteria ?? '').slice(0, 4000)
        : undefined;

    const assignment = assignmentPatchFromInput(input);
    const hasAssignment =
      assignment.assignee !== undefined ||
      assignment.owner !== undefined ||
      assignment.assignee_staff_id !== undefined ||
      assignment.priority !== undefined ||
      assignment.due_date !== undefined;

    if (titleIn == null && criteriaIn === undefined && !hasAssignment) {
      throw new BadRequestException({
        error: 'patch_required',
        message:
          'Provide title, acceptance_criteria, assignee/owner, priority, and/or due_date',
      });
    }

    let formData: Record<string, unknown> = {
      ...existing.form_data,
      ai_draft: true,
      ai_updated_by: meta.actor,
      ai_updated_at: meta.approvedAt,
      source_tool: 'task.update_draft',
    };
    if (hasAssignment) {
      formData = mergeAssignmentIntoFormData(formData, assignment);
    }

    const title =
      titleIn != null
        ? titleIn.startsWith(AI_TITLE_PREFIX)
          ? titleIn
          : `${AI_TITLE_PREFIX}${titleIn}`
        : undefined;

    const updated = await this.repo.updateAiDraftTask(taskId, {
      ...(title != null ? { title } : {}),
      ...(criteriaIn !== undefined ? { description: criteriaIn } : {}),
      form_data: formData,
    });

    return {
      ok: true,
      wired: true,
      phase: 'P3',
      status: 'persisted',
      tool: 'task.update_draft',
      requires_human_approval: true,
      human_approved: true,
      entity_ids: {
        task_id: taskId,
        lifecycle_id: updated?.lifecycle_id ?? existing.lifecycle_id,
      },
      links: [
        `/crm/service-delivery/${updated?.lifecycle_id ?? existing.lifecycle_id}`,
      ],
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

  /**
   * Task drafts must not silently land on an unrelated lifecycle.
   * Resolve only from explicitly provided keys; if a provided plan/project
   * has no lifecycle link, fail with lifecycle_required (no client fallthrough).
   */
  private async resolveLifecycleIdForTask(
    input: Record<string, unknown>,
  ): Promise<number> {
    const explicit = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    const planId = positiveInt(input.plan_id ?? input.planId);
    const projectId = String(input.project_id ?? input.projectId ?? '').trim();
    const clientId = String(input.client_id ?? input.clientId ?? '').trim();

    if (explicit == null && planId == null && !projectId && !clientId) {
      throw new BadRequestException({ error: 'lifecycle_required' });
    }

    if (explicit != null) {
      return explicit;
    }

    if (planId != null) {
      const plan = await this.repo.getPlan(planId);
      if (!plan) {
        throw new NotFoundException({ error: 'plan_not_found', plan_id: planId });
      }
      if (plan.lifecycle_id == null) {
        throw new BadRequestException({
          error: 'lifecycle_required',
          message: 'plan_id has no linked lifecycle; pass lifecycle_id explicitly',
          plan_id: planId,
        });
      }
      return plan.lifecycle_id;
    }

    if (projectId) {
      const project = await this.repo.getProject(projectId);
      if (!project) {
        throw new BadRequestException({ error: 'lifecycle_required' });
      }
      if (project.lifecycle_id == null) {
        throw new BadRequestException({
          error: 'lifecycle_required',
          message: 'project_id has no linked lifecycle; pass lifecycle_id explicitly',
          project_id: projectId,
        });
      }
      return project.lifecycle_id;
    }

    const lc = await this.repo.findPrimaryLifecycleByClient(clientId);
    if (!lc) {
      throw new BadRequestException({ error: 'lifecycle_required' });
    }
    return lc.id;
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
