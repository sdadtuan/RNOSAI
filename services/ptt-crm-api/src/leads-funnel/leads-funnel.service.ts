import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { parseB2CompletedAt } from '../cskh-board/cskh-board-sla.util';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { parseLeadMeta } from './care-pipeline.util';
import {
  AdvancePresalesBody,
  CompleteCareStageBody,
  ConsultPrefillBody,
  EnsurePresalesBody,
  LeadFunnelSnapshot,
  PatchMarketingPlanBody,
  PatchPresalesTaskBody,
  PresalesAiAssistBody,
  ReleaseReviewQueueBody,
} from './leads-funnel.types';
import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';
import { LeadsFunnelSqliteRepository } from './leads-funnel-sqlite.repository';
import { validatePreliminaryPlan } from './presales-marketing-plan.util';
import { buildPresalesConsultBrief } from './presales-consult-brief.util';
import {
  buildPresalesAiPromptContext,
  formatPresalesAiPrompt,
} from './presales-ai-prompt.util';
import { buildProposalAdvanceGate } from './presales-proposal-gate.util';
import { SERVICE_LABELS } from '../leads-contract/lifecycle-workflow-steps.util';
import { IntakeService } from '../intake/intake.service';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import {
  assertPresalesTaskFormComplete,
  mergePresalesFormData,
} from './presales-task-form.util';
import { reviewQueuePublicState } from './review-queue.util';
import { buildReviewQueueMetrics } from './review-queue-metrics.util';
import { buildReviewQueueAiSummary, computeReviewQueuePriority } from './review-queue-intelligence.util';
import { ReviewQueueLlmService } from './review-queue-llm.service';

@Injectable()
export class LeadsFunnelService {
  constructor(
    private readonly sqliteRepo: LeadsFunnelSqliteRepository,
    private readonly pgRepo: LeadsFunnelPgRepository,
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly leadSqlite: CrmLeadsSqliteRepository,
    private readonly cskhBoard: CskhBoardService,
    private readonly reviewQueueLlm: ReviewQueueLlmService,
    private readonly intake: IntakeService,
    private readonly llm: AiLlmClient,
  ) {}

  private get usePgFunnel(): boolean {
    return this.config.crmLeadsFunnelPg;
  }

  async getFunnel(leadId: number): Promise<LeadFunnelSnapshot> {
    const snap = this.usePgFunnel
      ? await this.pgRepo.buildSnapshot(leadId, this.config.presalesOnLead)
      : this.sqliteRepo.buildSnapshot(leadId, this.config.presalesOnLead);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    return snap;
  }

  async getCarePipeline(leadId: number) {
    const snap = await this.getFunnel(leadId);
    return { ok: true, ...snap.care_pipeline, presales_care_gate: snap.presales_care_gate };
  }

  private funnelError(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof NotFoundException) throw err;
    throw new BadRequestException({ error: msg, message: msg });
  }

  async submitCareReport(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
    userId: number | null,
  ) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.submitCareReport(leadId, body, actor, userId);
      } else {
        this.sqliteRepo.submitCareReport(leadId, body, actor, userId);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async completeCareStage(leadId: number, body: CompleteCareStageBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.completeCareStage(leadId, body, actor);
      } else {
        this.sqliteRepo.completeCareStage(leadId, body, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async reviewQueueCount(): Promise<{ count: number }> {
    const count = this.usePgFunnel
      ? await this.pgRepo.countReviewQueue()
      : this.sqliteRepo.countReviewQueue();
    return { count };
  }

  async reviewQueueMetrics(limit = 500) {
    const listed = await this.listReviewQueue(limit);
    return buildReviewQueueMetrics(
      listed.leads.map((row) => ({ hours_waiting: row.review_queue.hours_waiting })),
    );
  }

  async listReviewQueue(limit?: number) {
    const rows = this.usePgFunnel
      ? await this.pgRepo.listReviewQueue(limit)
      : this.sqliteRepo.listReviewQueue(limit);
    return {
      leads: rows.map((row) => ({
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        status: row.status,
        review_queue: reviewQueuePublicState(parseLeadMeta(row.meta_json), row.first_assigned_at || ''),
      })),
      total: rows.length,
    };
  }

  /** Phase 2 — AI summary line + suggested owner per review-queue lead. */
  async listReviewQueueAiSummaries(limit?: number, mode?: 'rules' | 'llm') {
    const rows = this.usePgFunnel
      ? await this.pgRepo.listReviewQueue(limit)
      : this.sqliteRepo.listReviewQueue(limit);
    const ids = rows.map((r) => Number(r.id));
    const firstCalls = this.leadSqlite.firstCallAtByLeadIds(ids);
    const ownerIds = rows.map((r) => Number(r.owner_id ?? 0)).filter((id) => id > 0);
    const ownerNames = this.leadSqlite.staffNamesByIds(ownerIds);

    let bestOwner: { id: number; name: string } | null = null;
    try {
      const intel = await this.cskhBoard.getManagerIntelligence();
      const top = intel.rep_performance[0];
      if (top) bestOwner = { id: top.owner_id, name: top.owner_name };
    } catch {
      bestOwner = null;
    }

    const contextRows = rows.map((row) => {
      const meta = parseLeadMeta(row.meta_json);
      const rq = reviewQueuePublicState(meta, row.first_assigned_at || '');
      const ownerId = row.owner_id ?? null;
      return {
        lead_id: row.id,
        full_name: row.full_name ?? '',
        status: String(row.status ?? ''),
        hours_waiting: rq.hours_waiting ?? null,
        owner_name: ownerId ? ownerNames.get(ownerId) ?? null : null,
        best_owner_name: bestOwner?.name ?? null,
      };
    });

    const summaries = rows.map((row) => {
      const meta = parseLeadMeta(row.meta_json);
      const b2At = parseB2CompletedAt(row.care_stages_done_json);
      const rq = reviewQueuePublicState(meta, row.first_assigned_at || '');
      const ownerId = row.owner_id ?? null;
      return buildReviewQueueAiSummary({
        leadId: row.id,
        fullName: row.full_name ?? '',
        status: String(row.status ?? ''),
        hoursWaiting: rq.hours_waiting ?? null,
        firstCallAt: firstCalls.get(row.id) ?? null,
        b2CompletedAt: b2At,
        ownerId,
        ownerName: ownerId ? ownerNames.get(ownerId) ?? null : null,
        bestOwnerId: bestOwner?.id ?? null,
        bestOwnerName: bestOwner?.name ?? null,
      });
    });

    if (mode === 'llm') {
      return this.reviewQueueLlm.enrichSummaries(summaries, contextRows);
    }

    const withPriority = summaries.map((summary) => {
      const ctx = contextRows.find((row) => row.lead_id === summary.lead_id);
      return {
        ...summary,
        priority_score: computeReviewQueuePriority(ctx?.hours_waiting),
        triage_source: 'rules' as const,
      };
    });

    return { ok: true, summaries: withPriority, total: withPriority.length, mode: 'rules' as const };
  }

  async syncReviewQueue(actor: string, dryRun = false) {
    return this.usePgFunnel
      ? this.pgRepo.syncReviewQueue(actor, dryRun)
      : this.sqliteRepo.syncReviewQueue(actor, dryRun);
  }

  async releaseReviewQueue(leadId: number, body: ReleaseReviewQueueBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.releaseFromReviewQueue(leadId, body, actor);
      } else {
        this.sqliteRepo.releaseFromReviewQueue(leadId, body, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getPresales(leadId: number) {
    const snap = await this.getFunnel(leadId);
    return { ok: true, presales: snap.presales };
  }

  async ensurePresales(leadId: number, body: EnsurePresalesBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.ensurePresales(leadId, body.service_slug, actor);
      } else {
        this.sqliteRepo.ensurePresales(leadId, body.service_slug, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getConsultAdvanceGate(leadId: number) {
    if (this.usePgFunnel) {
      const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
      if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
      const gate = await this.pgRepo.buildConsultAdvanceGate(leadId, ps.id);
      return { ok: true, gate, presales_stage: ps.stage };
    }
    const snap = this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const gate = this.sqliteRepo.buildConsultAdvanceGate(leadId, snap.presales.id);
    return { ok: true, gate, presales_stage: snap.presales.stage };
  }

  async advancePresales(leadId: number, body: AdvancePresalesBody, allowOverride = false) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.advancePresales(leadId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
          allowOverride,
        });
      } else {
        this.sqliteRepo.advancePresales(leadId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
          allowOverride,
        });
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async staffHasAssignCap(staffUser: StaffJwtPayload): Promise<boolean> {
    const me = await this.staffAuth.me(staffUser);
    return this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign');
  }

  async patchPresalesTask(
    leadId: number,
    taskId: number,
    body: PatchPresalesTaskBody,
    doneBy: number | null,
  ) {
    try {
      const task = this.usePgFunnel
        ? await this.pgRepo.getPresalesTaskById(taskId)
        : this.sqliteRepo.getPresalesTaskById(taskId);
      if (!task) {
        throw new NotFoundException({ error: 'Không tìm thấy task pre-sales' });
      }

      const mergedFormData = mergePresalesFormData(task.form_data, body.form_data);
      if (body.is_done === true) {
        assertPresalesTaskFormComplete(task.form_fields, mergedFormData);
      }

      const patchBody: PatchPresalesTaskBody = { ...body };
      if (body.form_data !== undefined || body.is_done === true) {
        patchBody.form_data = mergedFormData;
      }

      if (this.usePgFunnel) {
        await this.pgRepo.updatePresalesTask(taskId, patchBody, doneBy);
      } else {
        this.sqliteRepo.updatePresalesTask(taskId, patchBody, doneBy);
      }
      return { ok: true, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getMarketingPlan(leadId: number) {
    if (this.usePgFunnel) {
      const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
      if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
      const plan = await this.pgRepo.getOrCreatePreliminaryPlan(leadId, ps.id, ps.service_slug);
      const validation = validatePreliminaryPlan(plan);
      return { ok: true, plan, validation };
    }
    const snap = this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const plan = this.sqliteRepo.getOrCreatePreliminaryPlan(
      leadId,
      snap.presales.id,
      snap.presales.service_slug,
    );
    const validation = validatePreliminaryPlan(plan);
    return { ok: true, plan, validation };
  }

  async patchMarketingPlan(leadId: number, body: PatchMarketingPlanBody) {
    if (this.usePgFunnel) {
      const plan = await this.pgRepo.patchMarketingPlan(leadId, body);
      const validation = validatePreliminaryPlan(plan);
      return { ok: true, plan, validation, funnel: await this.getFunnel(leadId) };
    }
    const plan = this.sqliteRepo.patchMarketingPlan(leadId, body);
    const validation = validatePreliminaryPlan(plan);
    return { ok: true, plan, validation, funnel: await this.getFunnel(leadId) };
  }

  private async loadPresalesContext(leadId: number) {
    const snap = this.usePgFunnel
      ? await this.pgRepo.getPresalesSnapshot(leadId)
      : this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const intakeBundle = await this.intake.listSessions(leadId);
    const leadRow = this.usePgFunnel
      ? await this.pgRepo.fetchLeadRow(leadId)
      : this.sqliteRepo.fetchLeadRow(leadId);
    return { snap, intakeSessions: intakeBundle.sessions, leadName: leadRow?.full_name ?? '' };
  }

  async getPresalesConsultBrief(leadId: number) {
    const { snap, intakeSessions } = await this.loadPresalesContext(leadId);
    const leadTasks = snap.tasks.lead ?? [];
    const leadTaskDone =
      (snap.progress.lead?.total ?? 0) === 0 ||
      (snap.progress.lead?.done ?? 0) >= (snap.progress.lead?.total ?? 0);
    const brief = buildPresalesConsultBrief({
      presalesId: snap.presales.id,
      leadId,
      serviceSlug: snap.presales.service_slug,
      presalesStage: snap.presales.stage,
      leadTaskDone,
      leadTask: leadTasks[0] ?? null,
      intakeSessions,
    });
    return { ok: true, brief };
  }

  async prefillPresalesConsult(leadId: number, body: ConsultPrefillBody) {
    try {
      const out = this.usePgFunnel
        ? await this.pgRepo.runPresalesConsultPrefill(leadId, Boolean(body.overwrite))
        : this.sqliteRepo.runPresalesConsultPrefill(leadId, Boolean(body.overwrite));
      return { ok: true, ...out, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getPresalesProposalGate(leadId: number) {
    const { snap } = await this.loadPresalesContext(leadId);
    const plan = this.usePgFunnel
      ? await this.pgRepo.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug)
      : this.sqliteRepo.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug);
    const gate = buildProposalAdvanceGate({
      consultProgress: snap.progress.consult ?? { total: 0, done: 0 },
      plan: plan as {
        name?: string | null;
        north_star?: string | null;
        objectives?: string | null;
        strategy_framework_json?: string | null;
      },
    });
    return { ok: true, gate, presales_stage: snap.presales.stage };
  }

  async runPresalesTaskAiAssist(leadId: number, taskId: number, body: PresalesAiAssistBody) {
    try {
      const task = this.usePgFunnel
        ? await this.pgRepo.getPresalesTaskById(taskId)
        : this.sqliteRepo.getPresalesTaskById(taskId);
      if (!task) throw new NotFoundException({ error: 'Không tìm thấy task pre-sales' });

      const snap = this.usePgFunnel
        ? await this.pgRepo.getPresalesSnapshot(leadId)
        : this.sqliteRepo.getPresalesSnapshot(leadId);
      if (!snap || task.presales_id !== snap.presales.id) {
        throw new BadRequestException({ error: 'Task không thuộc pre-sales của lead' });
      }
      if (task.stage !== 'consult') {
        throw new BadRequestException({ error: 'AI assist chỉ hỗ trợ task Consult' });
      }
      const promptKey = String(task.ai_prompt_key || '').trim();
      if (!promptKey) {
        throw new BadRequestException({ error: 'Task không có AI prompt' });
      }

      const { intakeSessions, leadName } = await this.loadPresalesContext(leadId);
      const leadTasks = snap.tasks.lead ?? [];
      const leadTaskDone =
        (snap.progress.lead?.total ?? 0) === 0 ||
        (snap.progress.lead?.done ?? 0) >= (snap.progress.lead?.total ?? 0);
      const brief = buildPresalesConsultBrief({
        presalesId: snap.presales.id,
        leadId,
        serviceSlug: snap.presales.service_slug,
        presalesStage: snap.presales.stage,
        leadTaskDone,
        leadTask: leadTasks[0] ?? null,
        intakeSessions,
      });
      const serviceLabel = SERVICE_LABELS[snap.presales.service_slug] ?? snap.presales.service_slug;
      const ctx = buildPresalesAiPromptContext({
        brief,
        customerName: leadName || `Lead #${leadId}`,
        serviceLabel,
        formContext: body.form_context,
      });
      const prompt = formatPresalesAiPrompt(promptKey, ctx);
      if (!prompt) throw new BadRequestException({ error: 'Không tìm thấy AI template' });

      const llmOut = await this.llm.completeText({
        userContent: prompt,
        systemPrompt: 'Bạn là chuyên gia marketing agency PTT. Trả lời bằng tiếng Việt, súc tích, có cấu trúc.',
      });
      if (this.usePgFunnel) {
        await this.pgRepo.updatePresalesTaskAiOutput(taskId, llmOut.text);
      } else {
        this.sqliteRepo.updatePresalesTaskAiOutput(taskId, llmOut.text);
      }
      return {
        ok: true,
        task_id: taskId,
        ai_output: llmOut.text,
        stub_mode: llmOut.stubMode,
        funnel: await this.getFunnel(leadId),
      };
    } catch (err) {
      this.funnelError(err);
    }
  }
}
