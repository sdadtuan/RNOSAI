import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpsCrmContextRepository } from './ops-crm-context.repository';
import {
  OpsDodChecklistItem,
  OpsStageTransitionMeta,
  OpsStageTransitionResult,
  P4_STAGE_ORDER,
  P4Stage,
} from './ops-stage-transition.types';

function isAiDraftTitle(title: string): boolean {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .startsWith('[ai draft]');
}

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function normalizeStage(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'quote') return 'proposal';
  return s;
}

function stageIndex(stage: string): number {
  return (P4_STAGE_ORDER as readonly string[]).indexOf(stage);
}

function nextStage(from: string): P4Stage | null {
  const idx = stageIndex(from);
  if (idx < 0 || idx >= P4_STAGE_ORDER.length - 1) return null;
  return P4_STAGE_ORDER[idx + 1];
}

function isForwardNext(from: string, to: string): boolean {
  return nextStage(from) === to;
}

@Injectable()
export class OpsStageTransitionService {
  constructor(private readonly repo: OpsCrmContextRepository) {}

  async proposeTransition(
    input: Record<string, unknown>,
    meta: OpsStageTransitionMeta,
    opts: { humanApproved: boolean },
  ): Promise<OpsStageTransitionResult> {
    if (input.force === true || String(input.force ?? '').toLowerCase() === 'true') {
      throw new BadRequestException({
        error: 'force_forbidden',
        message: 'force is not allowed in P4',
      });
    }

    const lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (lifecycleId == null) {
      throw new BadRequestException({ error: 'lifecycle_required' });
    }

    const dryRun = input.dry_run === undefined ? true : Boolean(input.dry_run);
    if (!dryRun && !opts.humanApproved) {
      throw new ForbiddenException({
        error: 'human_approval_required',
        tool_name: 'service_delivery.propose_transition',
        message:
          'Apply transition requires human approval (X-AI-Human-Approved: 1) per SRS P4.',
      });
    }

    const lc = await this.repo.getLifecycleForTransition(lifecycleId);
    if (!lc) {
      throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
    }

    const fromStage = normalizeStage(lc.stage);
    if (fromStage === 'retain') {
      throw new ConflictException({ error: 'terminal_stage', stage: fromStage });
    }
    if (stageIndex(fromStage) < 0) {
      throw new ConflictException({
        error: 'invalid_transition',
        message: `Unknown current stage: ${lc.stage}`,
        from_stage: lc.stage,
      });
    }

    const requestedTo = input.to_stage != null ? normalizeStage(input.to_stage) : null;
    const toStage = requestedTo || nextStage(fromStage);
    if (!toStage) {
      throw new ConflictException({ error: 'terminal_stage', stage: fromStage });
    }
    if (stageIndex(toStage) < 0) {
      throw new ConflictException({
        error: 'invalid_transition',
        message: `Unknown to_stage: ${input.to_stage}`,
        to_stage: input.to_stage,
      });
    }
    if (!isForwardNext(fromStage, toStage)) {
      throw new ConflictException({
        error: 'invalid_transition',
        message: 'Only forward next-stage transitions are allowed in P4 (no skip/backward)',
        from_stage: fromStage,
        to_stage: toStage,
        expected_next: nextStage(fromStage),
      });
    }

    const openTasks = await this.repo.listOpenTasks(lifecycleId);
    const stageStats = await this.repo.countTasksByStage(lifecycleId, fromStage);
    const openInFromStage = openTasks.filter((t) => normalizeStage(t.stage) === fromStage);
    const blockingOpen = openInFromStage.filter((t) => !isAiDraftTitle(t.title));
    // [AI draft] tasks from plan.breakdown are planning artifacts — do not block P4 DoD.
    const effectiveStageStats =
      blockingOpen.length === 0
        ? {
            total: Math.max(stageStats.done, stageStats.total > 0 ? 1 : 0),
            open: 0,
            done: Math.max(stageStats.done, stageStats.total > 0 ? 1 : 0),
          }
        : {
            total: stageStats.total,
            open: blockingOpen.length,
            done: stageStats.done,
          };
    const checklist = this.evaluateDod(fromStage, toStage, {
      notes: lc.notes,
      openTasksInFromStage: blockingOpen,
      stageStats: effectiveStageStats,
    });
    const blockers = checklist
      .filter((c) => c.done !== true)
      .map((c) => c.item);

    const notes = String(input.notes ?? '').trim().slice(0, 2000);
    const proposalId = `stg-prop-${lifecycleId}-${fromStage}-${toStage}-${Date.now()}`;

    if (dryRun) {
      return {
        ok: true,
        wired: true,
        phase: 'P4',
        status: 'proposed',
        lifecycle_id: lifecycleId,
        from_stage: fromStage,
        to_stage: toStage,
        dry_run: true,
        dod_checklist: checklist,
        blockers,
        requires_human_approval: true,
        human_approved: Boolean(opts.humanApproved),
        proposal_id: proposalId,
        entity_ids: { lifecycle_id: lifecycleId },
        links: [`/crm/service-delivery/${lifecycleId}`],
      };
    }

    if (blockers.length > 0) {
      throw new BadRequestException({
        error: 'dod_incomplete',
        lifecycle_id: lifecycleId,
        from_stage: fromStage,
        to_stage: toStage,
        dod_checklist: checklist,
        blockers,
      });
    }

    const auditLine = `[AI transition ${fromStage}→${toStage} by ${meta.actor} at ${meta.approvedAt}]`;
    await this.repo.applyLifecycleStageTransition({
      lifecycleId,
      fromStage,
      toStage,
      notes: notes ? `${notes}\n${auditLine}` : auditLine,
      actorType: 'ai',
      actorLabel: meta.actor,
    });

    return {
      ok: true,
      wired: true,
      phase: 'P4',
      status: 'transitioned',
      lifecycle_id: lifecycleId,
      from_stage: fromStage,
      to_stage: toStage,
      dry_run: false,
      dod_checklist: checklist,
      blockers: [],
      requires_human_approval: true,
      human_approved: true,
      proposal_id: proposalId,
      entity_ids: { lifecycle_id: lifecycleId },
      links: [`/crm/service-delivery/${lifecycleId}`],
    };
  }

  private evaluateDod(
    fromStage: string,
    toStage: string,
    ctx: {
      notes: string;
      openTasksInFromStage: Array<{ id: number; title: string; stage: string }>;
      stageStats: { total: number; open: number; done: number };
    },
  ): OpsDodChecklistItem[] {
    const hasNotes = Boolean(ctx.notes?.trim());
    const edge = `${fromStage}->${toStage}`;
    const tasksDone =
      ctx.stageStats.total === 0
        ? ('unknown' as const)
        : ctx.stageStats.open === 0
          ? true
          : false;

    const items: OpsDodChecklistItem[] = [];

    switch (edge) {
      case 'lead->consult':
        items.push({
          item: 'first_response_or_note',
          done: tasksDone === true || hasNotes ? true : tasksDone,
          detail: hasNotes ? 'lifecycle notes present' : undefined,
        });
        break;
      case 'consult->proposal':
        items.push({
          item: 'brief_or_scope_note',
          done: hasNotes || tasksDone === true ? true : tasksDone,
        });
        break;
      case 'proposal->onboard':
        items.push({
          item: 'quote_or_proposal_ready',
          done: tasksDone === true || hasNotes ? true : tasksDone,
        });
        break;
      case 'onboard->deliver':
        items.push({
          item: 'onboard_tasks_done',
          done: tasksDone,
          detail:
            ctx.stageStats.total === 0
              ? 'no onboard tasks — unknown'
              : `${ctx.stageStats.done}/${ctx.stageStats.total} done`,
        });
        break;
      case 'deliver->handover':
        items.push({
          item: 'delivery_critical_tasks_done',
          done: tasksDone,
        });
        break;
      case 'handover->retain':
        items.push({
          item: 'handover_confirmed',
          done: tasksDone === true || hasNotes ? true : tasksDone,
        });
        break;
      default:
        items.push({ item: 'forward_edge_dod', done: 'unknown' });
    }

    if (ctx.openTasksInFromStage.length > 0 && tasksDone !== true) {
      items.push({
        item: 'no_open_tasks_in_from_stage',
        done: false,
        detail: `${ctx.openTasksInFromStage.length} open`,
      });
    }

    return items;
  }
}
