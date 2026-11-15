import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OpsService } from '../ops/ops.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { SopPgRepository } from '../sop/sop-pg.repository';
import { SvcFinanceService } from '../svc-finance/svc-finance.service';
import { LifecycleConsultService } from './lifecycle-consult.service';
import { LifecycleFinanceConfirmRepository } from './lifecycle-finance-confirm.repository';
import { LifecycleLaunchQaService } from './lifecycle-launch-qa.service';
import { LifecycleOnboardingService } from './lifecycle-onboarding.service';
import { validateOnboardDeliverGate } from './lifecycle-onboard-gate.util';
import {
  buildOfficialPlanPayload,
  mergeStrategyFramework,
  mergeTargetMarketProf,
  parsePlanContent,
  validateOfficialTmmt,
} from './lifecycle-marketing-plan.util';
import { buildOfficialTmmtSeedFromConsult } from './lifecycle-tmmt-seed.util';
import { paymentGateFromSummary } from './lifecycle-payment-gate.util';
import type { LaunchQaHandoverGateResult } from './lifecycle-launch-handover-gate.util';
import { getStageAdvanceInfo, nextStage, StageAdvanceError, validateStageAdvance } from './lifecycle-stage.util';
import { LifecycleTasksPgRepository, type SvcTaskRow } from './lifecycle-tasks-pg.repository';
import { ServiceLifecyclePgRepository } from './service-lifecycle-pg.repository';
import {
  CreateServiceLifecycleBody,
  isValidSlug,
  isValidStage,
  PatchServiceLifecycleBody,
  ServiceLifecycleRow,
  VALID_STAGES,
} from './service-lifecycle.types';
import { isAccountManagerPosition, isMarketingLeaderPosition } from '../b2b-projects/b2b-director.util';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';
import type { WorkingHoursConfig } from '../lead-sla-settings/lead-sla-working-hours.util';
import {
  appendActualHoursLog,
  appendAssigneeHistory,
  computeDueYmd,
  dueEndAt,
  isTaskOverdue,
  normalizeWorkStatus,
  quoteHoursFromForm,
  readActualHoursLog,
  sumActualHours,
  summarizeDeliveryOps,
  taskOnTime,
  workStatusIsDone,
  type WorkStatus,
} from './delivery-ops.util';
import {
  applyClientGateDecision,
  clientGatesBlockReason,
  normalizeClientGateKey,
  parseClientGates,
  serializeClientGates,
  type ClientGateDecision,
} from './client-gates.util';

@Injectable()
export class ServiceLifecycleService {
  constructor(
    private readonly pg: ServiceLifecyclePgRepository,
    private readonly tasksPg: LifecycleTasksPgRepository,
    private readonly svcFinance: SvcFinanceService,
    private readonly consult: LifecycleConsultService,
    private readonly sopPg: SopPgRepository,
    private readonly config: AppConfigService,
    private readonly lifecycleLaunchQa: LifecycleLaunchQaService,
    private readonly lifecycleOnboarding: LifecycleOnboardingService,
    private readonly financeConfirmRepo: LifecycleFinanceConfirmRepository,
    private readonly staffAuth: StaffAuthService,
    @Inject(forwardRef(() => OpsService)) private readonly ops: OpsService,
  ) {}

  private async getLifecycleById(id: number): Promise<ServiceLifecycleRow | null> {
    return this.pg.getLifecycleById(id);
  }

  private async isStageComplete(lifecycleId: number, stage: string): Promise<boolean> {
    return this.tasksPg.isStageComplete(lifecycleId, stage);
  }

  private async getOfficialMarketingPlan(lifecycleId: number): Promise<Record<string, unknown> | null> {
    return this.pg.getOfficialMarketingPlan(lifecycleId);
  }

  async list(serviceSlug?: string, amId?: string, includeDraft?: string) {
    const am = amId ? Number(amId) : undefined;
    const opts = {
      serviceSlug: serviceSlug || undefined,
      amId: am && Number.isFinite(am) && am > 0 ? am : undefined,
      includeDraft: includeDraft === '1',
    };
    const lifecycles = await this.pg.listLifecycles(opts);
    const funnel_stats = await this.pg.funnelStats();
    return { lifecycles, funnel_stats };
  }

  async detail(id: number) {
    const lifecycle = await this.getLifecycleById(id);
    if (!lifecycle) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    const events = await this.pg.listEvents(id);
    return { ...lifecycle, events };
  }

  async events(id: number) {
    await this.requireLifecycle(id);
    return {
      events: await this.pg.listEvents(id),
    };
  }

  async create(body: CreateServiceLifecycleBody) {
    const serviceSlug = String(body.service_slug ?? '').trim();
    if (!serviceSlug) {
      throw new BadRequestException({ error: 'Cần service_slug' });
    }
    if (!isValidSlug(serviceSlug)) {
      throw new BadRequestException({ error: 'service_slug không hợp lệ' });
    }
    return this.pg.createDraft(body);
  }

  async setCommercialSku(lifecycleId: number, skuCode: string): Promise<void> {
    const sku = String(skuCode ?? '').trim().toUpperCase();
    if (!sku) return;
    await this.pg.setCommercialSku(lifecycleId, sku);
  }

  async patch(
    id: number,
    body: PatchServiceLifecycleBody,
    actor?: { staffId?: number; email?: string; positionId?: number },
  ) {
    const existing = await this.getLifecycleById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }

    if ('stage' in body && body.stage != null) {
      const toStage = String(body.stage).trim();
      if (!isValidStage(toStage)) {
        throw new BadRequestException({ error: `Stage không hợp lệ: ${toStage}` });
      }
      const financeConfirm = Boolean(body.finance_confirm);
      if (financeConfirm) {
        const gate = await this.paymentGate(id, existing.stage, toStage, true, actor?.positionId);
        if (this.config.financeGateStrict && gate && !gate.can_confirm) {
          throw new BadRequestException({
            error: 'finance_role_required',
            message: 'Strict mode — chỉ Finance mới được xác nhận công nợ',
          });
        }
      }
      try {
        validateStageAdvance({
          fromStage: existing.stage,
          toStage,
          currentStageComplete: await this.isStageComplete(id, existing.stage),
          tmmtGate: await this.tmmtGate(id, existing.stage, toStage),
          onboardGate: await this.onboardGate(id, existing.stage, toStage),
          paymentGate: await this.paymentGate(id, existing.stage, toStage, financeConfirm, actor?.positionId),
          launchQaGate: await this.launchQaGate(id, existing.stage, toStage, Boolean(body.launch_qa_confirm)),
          clientGate: await this.clientAdvanceGate(id, existing.stage, toStage),
        });
      } catch (err) {
        if (err instanceof StageAdvanceError) {
          throw new BadRequestException({ error: err.message, block_reason: err.message });
        }
        throw err;
      }
      const notes =
        'notes' in body && typeof body.notes === 'string'
          ? body.notes.trim().slice(0, 2000)
          : existing.notes;
      const advanced = await this.pg.advanceStage(id, toStage, notes);
      if (existing.stage === 'handover' && toStage === 'retain' && financeConfirm && advanced) {
        const summary = this.svcFinance.summary(id) as {
          outstanding_vnd?: number;
          ar_pending_vnd?: number;
          ar_overdue_vnd?: number;
        };
        await this.financeConfirmRepo.insertConfirm({
          lifecycleId: id,
          staffId: actor?.staffId ?? null,
          staffEmail: actor?.email ?? 'staff',
          outstandingVnd: Number(summary.outstanding_vnd ?? 0),
          arPendingVnd: Number(summary.ar_pending_vnd ?? 0),
          arOverdueVnd: Number(summary.ar_overdue_vnd ?? 0),
          strictMode: this.config.financeGateStrict,
          note: body.notes != null ? String(body.notes).slice(0, 500) : null,
        });
      }
      if (toStage === 'consult' && advanced) {
        try {
          await this.consult.prefillConsultTask(id, { overwrite: false });
        } catch {
          /* prefill is best-effort on advance */
        }
      }
      if (toStage === 'deliver' && advanced) {
        try {
          await this.lifecycleLaunchQa.maybeAutoStartOnDeliver(id);
        } catch {
          /* auto-start is best-effort on advance */
        }
        if (
          this.config.opsSpawnOnDeliverEnabled &&
          this.config.opsWeeklySpawnEnabled &&
          this.config.opsDvEnabled
        ) {
          try {
            const spawnedBy = actor?.email ?? 'system-deliver-advance';
            await this.ops.spawnWeek(id, spawnedBy);
          } catch {
            /* spawn optional — deliver advance still succeeds */
          }
        }
      }
      return advanced;
    }

    if ('service_slug' in body && body.service_slug != null) {
      const slug = String(body.service_slug).trim();
      if (slug && !isValidSlug(slug)) {
        throw new BadRequestException({ error: 'service_slug không hợp lệ' });
      }
    }

    const updated = await this.pg.patchLifecycle(id, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    return updated;
  }

  async advanceInfo(id: number, actorPositionId?: number, actorStaffId?: number) {
    const lc = await this.requireLifecycle(id);
    const prog = (await this.tasksPg.getProgress(id))[lc.stage] ?? { done: 0, total: 0 };
    const complete = await this.isStageComplete(id, lc.stage);
    const plan = await this.getOfficialMarketingPlan(id);
    const tmmtGate = lc.stage === 'onboard' ? validateOfficialTmmt(plan) : undefined;
    const onboardGate =
      lc.stage === 'onboard' ? await this.onboardGate(id, lc.stage, 'deliver') : undefined;
    const paymentGate =
      lc.stage === 'handover'
        ? await this.paymentGate(id, lc.stage, 'retain', false, actorPositionId)
        : undefined;
    let launchQaGate: LaunchQaHandoverGateResult | undefined;
    if (lc.stage === 'deliver') {
      try {
        launchQaGate = await this.lifecycleLaunchQa.launchQaGateForLifecycle(id);
      } catch {
        launchQaGate = undefined;
      }
    }
    const clientGates = await this.readClientGates(id);
    const nxt = nextStage(lc.stage) ?? '';
    const clientBlock = clientGatesBlockReason(lc.stage, nxt, clientGates);
    const positionCode = actorStaffId ? await this.pg.staffPositionCode(actorStaffId) : null;
    const canRecord = await this.canRecordClientGates(id, actorStaffId ?? null, positionCode);
    return getStageAdvanceInfo({
      currentStage: lc.stage,
      currentStageComplete: complete,
      currentDone: prog.done,
      currentTotal: prog.total,
      tmmtGate,
      onboardGate: onboardGate
        ? {
            ok: onboardGate.ok,
            messages: onboardGate.messages,
            orchestrator_percent: onboardGate.orchestrator_percent,
            checklist_percent: onboardGate.checklist_percent,
          }
        : undefined,
      paymentGate,
      launchQaGate,
      clientGate: clientBlock ? { ok: false, messages: [clientBlock] } : { ok: true, messages: [] },
      client_gates: { ...clientGates, can_record: canRecord },
    });
  }

  async listFinanceConfirms(id: number) {
    await this.requireLifecycle(id);
    return { rows: await this.financeConfirmRepo.listForLifecycle(id) };
  }

  async autoAdvanceOnboardIfEligible(clientId: string): Promise<{
    advanced: boolean;
    lifecycle_id: number | null;
    reason: string;
  }> {
    if (!this.config.onboardAutoAdvanceLifecycle) {
      return { advanced: false, lifecycle_id: null, reason: 'auto_advance_disabled' };
    }
    const ctx = await this.pg.findOnboardLifecycleByAgencyClientId(clientId);
    if (!ctx) {
      return { advanced: false, lifecycle_id: null, reason: 'no_onboard_lifecycle' };
    }
    const lifecycleId = ctx.lifecycle_id;
    if (!(await this.isStageComplete(lifecycleId, 'onboard'))) {
      return { advanced: false, lifecycle_id: lifecycleId, reason: 'onboard_tasks_incomplete' };
    }
    const onboardGate = await this.onboardGate(lifecycleId, 'onboard', 'deliver');
    if (!onboardGate?.ok) {
      return { advanced: false, lifecycle_id: lifecycleId, reason: 'onboard_gate_blocked' };
    }
    const tmmtGate = validateOfficialTmmt(await this.getOfficialMarketingPlan(lifecycleId));
    if (!tmmtGate.ok) {
      return { advanced: false, lifecycle_id: lifecycleId, reason: 'tmmt_incomplete' };
    }
    const advanced = await this.pg.advanceStage(
      lifecycleId,
      'deliver',
      'Auto-advance orchestrator 100%',
    );
    if (advanced) {
      try {
        await this.lifecycleLaunchQa.maybeAutoStartOnDeliver(lifecycleId);
      } catch {
        /* best-effort */
      }
    }
    return {
      advanced: Boolean(advanced),
      lifecycle_id: lifecycleId,
      reason: advanced ? 'advanced_to_deliver' : 'advance_failed',
    };
  }

  async listTasks(id: number) {
    await this.requireLifecycle(id);
    const { tasks, ops } = await this.enrichedTasks(id);
    return { tasks, ops };
  }

  async progress(id: number) {
    await this.requireLifecycle(id);
    const progress = await this.tasksPg.getProgress(id);
    return { progress };
  }

  async updateTask(
    lifecycleId: number,
    taskId: number,
    body: {
      is_done?: boolean;
      notes?: string;
      form_data?: Record<string, unknown>;
      assignee?: string | null;
      owner?: string | null;
      assignee_staff_id?: number | null;
      assignee_reason?: string | null;
      priority?: string | null;
      due_date?: string | null;
      work_status?: string;
      hours?: number;
      qty?: number;
      actual_hours_entry?: { hours?: number; note?: string };
    },
    doneBy?: number | null,
    actor?: { staffId?: number | null; name?: string; positionCode?: string | null },
  ) {
    await this.requireLifecycle(lifecycleId);
    const task = await this.tasksPg.getTask(taskId);
    if (!task || task.lifecycle_id !== lifecycleId) {
      throw new NotFoundException({ error: 'Không tìm thấy task' });
    }
    const staffId = actor?.staffId ?? doneBy ?? null;
    const actorName = String(actor?.name ?? '').trim();
    const positionCode = actor?.positionCode ?? (staffId ? await this.pg.staffPositionCode(staffId) : null);
    let formData: Record<string, unknown> = { ...task.form_data, ...(body.form_data ?? {}) };

    let workStatus: WorkStatus | undefined;
    if (body.work_status != null) {
      workStatus = normalizeWorkStatus(body.work_status);
    } else if (body.is_done != null) {
      workStatus = body.is_done ? 'done' : 'todo';
    }
    let isDone = body.is_done;
    if (workStatus) {
      formData.work_status = workStatus;
      isDone = workStatusIsDone(workStatus);
    }

    const hoursChanged =
      body.hours != null || body.qty != null || body.form_data?.hours != null || body.form_data?.qty != null;
    if (body.hours != null) formData.hours = Number(body.hours);
    if (body.qty != null) formData.qty = Number(body.qty);

    if (body.actual_hours_entry) {
      const hours = Number(body.actual_hours_entry.hours);
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new BadRequestException({ error: 'Giờ thực phải là số dương.' });
      }
      formData = appendActualHoursLog(formData, {
        staff_id: staffId,
        staff_name: actorName || (staffId ? await this.pg.staffName(staffId) : ''),
        hours: Math.round(hours * 100) / 100,
        note: String(body.actual_hours_entry.note ?? '').trim().slice(0, 500),
        at: new Date().toISOString(),
      });
    }

    const nextStaffId = body.assignee_staff_id !== undefined ? body.assignee_staff_id : undefined;
    const staffIdChanging =
      nextStaffId !== undefined && Number(nextStaffId ?? 0) !== Number(task.assignee_staff_id ?? 0);
    const textAssignee = body.assignee !== undefined ? body.assignee : body.owner;
    const textChanging =
      textAssignee !== undefined && String(textAssignee ?? '').trim() !== String(task.assignee ?? '').trim();
    if (staffIdChanging || (textChanging && body.assignee_reason != null)) {
      const asSuper = isSuperAdminPositionCode(positionCode);
      const asMkl = isMarketingLeaderPosition(positionCode);
      if (!asSuper && !asMkl) {
        throw new BadRequestException({ error: 'Chỉ Marketing Leader hoặc Super-Admin được đổi người.' });
      }
      const reason = String(body.assignee_reason ?? '').trim();
      if (!reason) {
        throw new BadRequestException({ error: 'Cần lý do khi đổi người.' });
      }
      const toId = nextStaffId != null && Number(nextStaffId) > 0 ? Number(nextStaffId) : null;
      const toName = toId ? await this.pg.staffName(toId) : String(textAssignee ?? '').trim();
      if (toId && !toName) {
        throw new BadRequestException({ error: 'Không tìm thấy nhân sự.' });
      }
      formData = appendAssigneeHistory(formData, {
        from_staff_id: task.assignee_staff_id,
        from_name: String(task.assignee ?? ''),
        to_staff_id: toId,
        to_name: toName,
        reason,
        by_staff_id: staffId,
        by_name: actorName || (staffId ? await this.pg.staffName(staffId) : ''),
        at: new Date().toISOString(),
      });
      if (toName) body.assignee = toName;
    } else if (textChanging && nextStaffId === undefined) {
      throw new BadRequestException({ error: 'Đổi người phải chọn Nhân sự và ghi lý do.' });
    }

    const updated = await this.tasksPg.updateTask(taskId, {
      ...body,
      is_done: isDone,
      form_data: formData,
      done_by: isDone === true ? staffId : isDone === false ? null : (doneBy ?? null),
    });
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy task' });
    }
    if (hoursChanged || staffIdChanging) {
      await this.recomputeTaskDues(lifecycleId, taskId);
    }
    const calendar = await this.pg.workingCalendar();
    return { task: this.decorateTask(updated, calendar.workingHours, new Date()) };
  }

  async recordClientGate(
    lifecycleId: number,
    body: { gate?: string; decision?: string; note?: string },
    actor?: { staffId?: number | null; name?: string; positionCode?: string | null },
  ) {
    const lc = await this.requireLifecycle(lifecycleId);
    const staffId = actor?.staffId ?? null;
    const positionCode = actor?.positionCode ?? (staffId ? await this.pg.staffPositionCode(staffId) : null);
    const asSuper = isSuperAdminPositionCode(positionCode);
    const asAm =
      isAccountManagerPosition(positionCode) ||
      (staffId != null && lc.assigned_am != null && Number(lc.assigned_am) === Number(staffId));
    if (!asSuper && !asAm) {
      throw new BadRequestException({ error: 'Chỉ AM phụ trách hoặc Super-Admin ghi cửa khách duyệt.' });
    }
    const key = normalizeClientGateKey(body.gate);
    if (!key) {
      throw new BadRequestException({ error: 'Cửa duyệt không hợp lệ (Kế hoạch, Go-live, Nghiệm thu).' });
    }
    const decisionRaw = String(body.decision ?? '').trim();
    const decision: ClientGateDecision =
      decisionRaw === 'approved' || decisionRaw === 'khach_duyet' || decisionRaw === 'duyet'
        ? 'approved'
        : decisionRaw === 'revision_requested' || decisionRaw === 'yeu_cau_sua' || decisionRaw === 'sua'
          ? 'revision_requested'
          : ('' as ClientGateDecision);
    if (decision !== 'approved' && decision !== 'revision_requested') {
      throw new BadRequestException({ error: 'Chọn khách duyệt hoặc yêu cầu sửa.' });
    }
    const note = String(body.note ?? '').trim();
    if (!note) {
      throw new BadRequestException({ error: 'Cần ghi chú khi ghi cửa khách duyệt.' });
    }
    const current = await this.readClientGates(lifecycleId);
    const next = applyClientGateDecision(
      current,
      key,
      decision,
      note,
      { staffId, name: String(actor?.name ?? '').trim() || (staffId ? await this.pg.staffName(staffId) : '') },
      new Date(),
    );
    await this.pg.saveClientGatesJson(lifecycleId, serializeClientGates(next));
    return { client_gates: next };
  }


  async createCustomTask(
    lifecycleId: number,
    body: { stage?: string; title?: string; description?: string },
  ) {
    await this.requireLifecycle(lifecycleId);
    const stage = String(body.stage ?? '').trim();
    if (!isValidStage(stage)) {
      throw new BadRequestException({ error: 'Stage không hợp lệ' });
    }
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Cần title' });
    }
    const task = await this.tasksPg.createCustomTask(
      lifecycleId,
      stage,
      title,
      String(body.description ?? ''),
    );
    return { task };
  }

  async marketingPlan(id: number) {
    await this.requireLifecycle(id);
    const plan = await this.getOfficialMarketingPlan(id);
    return buildOfficialPlanPayload(plan);
  }

  async patchMarketingPlan(id: number, body: Record<string, unknown>) {
    const lc = await this.requireLifecycle(id);
    if (!lc.marketing_plan_id) {
      throw new NotFoundException({ error: 'Chưa có Kế hoạch MKT chính thức' });
    }
    const existing = await this.getOfficialMarketingPlan(id);
    const patch: Record<string, unknown> = { ...body };
    if (body.strategy_framework && typeof body.strategy_framework === 'object') {
      patch.strategy_framework_json = mergeStrategyFramework(
        String(existing?.strategy_framework_json ?? '{}'),
        body.strategy_framework as Record<string, string>,
      );
      delete patch.strategy_framework;
    }
    if (body.target_market_prof && typeof body.target_market_prof === 'object') {
      patch.target_market_prof_json = mergeTargetMarketProf(
        String(existing?.target_market_prof_json ?? '{}'),
        body.target_market_prof as Record<string, string>,
      );
      delete patch.target_market_prof;
    }
    const plan = await this.pg.updateOfficialMarketingPlan(lc.marketing_plan_id, patch);
    if (!plan) {
      throw new NotFoundException({ error: 'Không tìm thấy plan' });
    }
    return buildOfficialPlanPayload(plan);
  }

  async marketingPlanValidation(id: number) {
    await this.requireLifecycle(id);
    const plan = await this.getOfficialMarketingPlan(id);
    return validateOfficialTmmt(plan);
  }

  async prefillMarketingPlanFromConsult(
    id: number,
    opts: { overwrite?: boolean } = {},
  ): Promise<
    ReturnType<typeof buildOfficialPlanPayload> & {
      filled_keys: string[];
      prefill_source: 'consult-intake';
    }
  > {
    const lc = await this.requireLifecycle(id);
    if (!lc.marketing_plan_id) {
      throw new NotFoundException({ error: 'Chưa có Kế hoạch MKT chính thức' });
    }
    const existing = await this.getOfficialMarketingPlan(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy plan' });
    }
    const { strategy_framework, target_market_prof } = parsePlanContent(existing);
    const consultBrief = await this.consult.getConsultBrief(id);
    const seed = buildOfficialTmmtSeedFromConsult({
      consultBrief,
      existingProf: target_market_prof,
      existingSf: strategy_framework,
      overwrite: Boolean(opts.overwrite),
    });
    if (!seed.filled_keys.length) {
      return {
        ...buildOfficialPlanPayload(existing),
        filled_keys: [],
        prefill_source: 'consult-intake',
      };
    }
    const plan = await this.pg.updateOfficialMarketingPlan(lc.marketing_plan_id, {
      strategy_framework_json: mergeStrategyFramework(
        String(existing.strategy_framework_json ?? '{}'),
        seed.strategy_framework,
      ),
      target_market_prof_json: mergeTargetMarketProf(
        String(existing.target_market_prof_json ?? '{}'),
        seed.target_market_prof,
      ),
    });
    if (!plan) {
      throw new NotFoundException({ error: 'Không tìm thấy plan' });
    }
    return {
      ...buildOfficialPlanPayload(plan),
      filled_keys: seed.filled_keys,
      prefill_source: 'consult-intake',
    };
  }

  async presalesSummary(id: number) {
    await this.requireLifecycle(id);
    return this.pg.presalesSummary(id);
  }

  async createExpense(id: number, body: Record<string, unknown>) {
    await this.requireLifecycle(id);
    return this.pg.createExpense(id, body);
  }

  financeSummary(id: number) {
    return this.svcFinance.summary(id);
  }

  async listPayments(id: number) {
    await this.requireLifecycle(id);
    return this.svcFinance.listPayments(id);
  }

  async context(id: number) {
    const ctx = await this.pg.getLifecycleContext(id);
    if (!ctx) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    return ctx;
  }

  async findPrimaryLifecycleByAgencyClientId(clientId: string): Promise<{
    lifecycle_id: number;
    service_slug: string;
    stage: string;
  } | null> {
    const trimmed = String(clientId ?? '').trim();
    if (!trimmed) return null;
    return this.pg.findPrimaryLifecycleByAgencyClientId(trimmed);
  }

  async sop(id: number) {
    const lc = await this.requireLifecycle(id);
    const autoStartEnabled = this.config.sopAutoStartOnLaunch;
    const templateCode = 'MKT-LAUNCH-14D';
    if (!lc.sop_run_id) {
      return {
        lifecycle_id: id,
        sop_run_id: null,
        auto_start_enabled: autoStartEnabled,
        template_code: templateCode,
        run: null,
        tasks: [],
        message: autoStartEnabled
          ? 'Chưa có SOP run — sẽ tạo khi GDKD duyệt HĐ (lifecycle_once).'
          : 'PTT_SOP_AUTO_START_ON_LAUNCH đang tắt.',
      };
    }
    const run = await this.sopPg.getRunById(lc.sop_run_id);
    const tasks = run ? await this.sopPg.listRunTasks(lc.sop_run_id) : [];
    return {
      lifecycle_id: id,
      sop_run_id: lc.sop_run_id,
      auto_start_enabled: autoStartEnabled,
      template_code: templateCode,
      run,
      tasks,
      message: run ? null : 'sop_run_id không còn hợp lệ — liên hệ admin.',
    };
  }

  consultBrief(id: number) {
    return this.consult.getConsultBrief(id);
  }

  consultPrefill(id: number, body: Record<string, unknown>) {
    return this.consult.prefillConsultTask(id, { overwrite: Boolean(body.overwrite) });
  }

  launchQa(id: number) {
    return this.lifecycleLaunchQa.launchQa(id);
  }

  startLaunchQa(id: number, startedBy?: string) {
    return this.lifecycleLaunchQa.startLaunchQa(id, startedBy);
  }

  patchLaunchQaChecklist(
    id: number,
    itemKey: string,
    body: { completed?: boolean; note?: string },
    completedBy?: string,
  ) {
    return this.lifecycleLaunchQa.patchChecklistItem(id, itemKey, body, completedBy);
  }

  creativeBrief(id: number) {
    return this.lifecycleLaunchQa.creativeBrief(id);
  }

  submitCreative(id: number, body: Record<string, unknown>) {
    return this.lifecycleLaunchQa.submitCreative(id, {
      title: body.title != null ? String(body.title) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      asset_url: body.asset_url != null ? String(body.asset_url) : undefined,
      asset_type: body.asset_type != null ? String(body.asset_type) : undefined,
      submitted_by: body.submitted_by != null ? String(body.submitted_by) : undefined,
      resubmit: Boolean(body.resubmit),
    });
  }

  budgetBrief(id: number) {
    return this.lifecycleLaunchQa.budgetBrief(id);
  }

  onboardingBrief(id: number) {
    return this.lifecycleOnboarding.onboardingBrief(id);
  }

  submitBudget(id: number, body: { daily_budget_vnd?: number; submitted_by?: string }) {
    return this.lifecycleLaunchQa.submitBudget(id, body);
  }

  private async requireLifecycle(id: number): Promise<ServiceLifecycleRow> {
    const lc = await this.getLifecycleById(id);
    if (!lc) {
      throw new NotFoundException({ error: 'Không tìm thấy lifecycle' });
    }
    return lc;
  }

  private async tmmtGate(lifecycleId: number, fromStage: string, toStage: string) {
    if (toStage === 'deliver' && fromStage === 'onboard') {
      return validateOfficialTmmt(await this.getOfficialMarketingPlan(lifecycleId));
    }
    return undefined;
  }

  private async paymentGate(
    lifecycleId: number,
    fromStage: string,
    toStage: string,
    financeConfirm: boolean,
    positionId?: number,
  ) {
    if (toStage !== 'retain' || fromStage !== 'handover') return undefined;
    const summary = this.svcFinance.summary(lifecycleId) as {
      outstanding_vnd?: number;
      ar_pending_vnd?: number;
      ar_overdue_vnd?: number;
    };
    let financeCap = false;
    if (positionId) {
      financeCap = await this.staffAuth.hasCapForPosition(
        positionId,
        'crm_business_dashboard',
        'view',
      );
    }
    return paymentGateFromSummary(summary, {
      financeConfirm,
      strictMode: this.config.financeGateStrict,
      hasFinanceCap: financeCap,
    });
  }

  private async onboardGate(lifecycleId: number, fromStage: string, toStage: string) {
    if (toStage !== 'deliver' || fromStage !== 'onboard') return undefined;
    const brief = await this.lifecycleOnboarding.onboardingBrief(lifecycleId);
    const orchestratorPercent = Number(brief.orchestrator?.progress.required_percent ?? brief.progress.percent ?? 0);
    const checklistPercent = Number(brief.progress.percent ?? 0);
    return validateOnboardDeliverGate({
      orchestratorRequiredPercent: orchestratorPercent,
      checklistPercent,
      clientActive: brief.client_status === 'active',
    });
  }

  private async launchQaGate(
    lifecycleId: number,
    fromStage: string,
    toStage: string,
    launchQaConfirm: boolean,
  ) {
    if (toStage !== 'handover' || fromStage !== 'deliver') return undefined;
    const gate = await this.lifecycleLaunchQa.launchQaGateForLifecycle(lifecycleId, launchQaConfirm);
    return { ok: gate.ok, messages: gate.messages };
  }
  private async readClientGates(lifecycleId: number) {
    return parseClientGates(await this.pg.getClientGatesJson(lifecycleId));
  }

  private async clientAdvanceGate(lifecycleId: number, fromStage: string, toStage: string) {
    const gates = await this.readClientGates(lifecycleId);
    const reason = clientGatesBlockReason(fromStage, toStage, gates);
    return reason ? { ok: false, messages: [reason] } : { ok: true, messages: [] as string[] };
  }

  private async canRecordClientGates(
    lifecycleId: number,
    staffId: number | null,
    positionCode?: string | null,
  ): Promise<boolean> {
    if (isSuperAdminPositionCode(positionCode)) return true;
    if (staffId != null) {
      const ts = await this.pg.lifecycleTimestamps(lifecycleId);
      if (ts.assigned_am != null && Number(ts.assigned_am) === Number(staffId)) return true;
    }
    return isAccountManagerPosition(positionCode);
  }

  private decorateTask(task: SvcTaskRow, workingHours: WorkingHoursConfig, now: Date) {
    const workStatus = normalizeWorkStatus(task.work_status ?? task.form_data?.work_status, task.is_done);
    const actual = task.actual_hours || sumActualHours(readActualHoursLog(task.form_data));
    const label =
      workStatus === 'todo'
        ? 'Chờ làm'
        : workStatus === 'in_progress'
          ? 'Đang làm'
          : workStatus === 'done'
            ? 'Xong'
            : 'Không áp dụng';
    return {
      ...task,
      work_status: workStatus,
      work_status_label: label,
      overdue: isTaskOverdue({ workStatus, dueDate: task.due_date, now, workingHours }),
      on_time: taskOnTime({ workStatus, dueDate: task.due_date, doneAt: task.done_at, now, workingHours }),
      quote_hours: task.quote_hours || quoteHoursFromForm(task.form_data),
      actual_hours: actual,
      actual_hours_log: task.actual_hours_log ?? readActualHoursLog(task.form_data),
    };
  }

  private async enrichedTasks(lifecycleId: number) {
    const grouped = await this.tasksPg.listTasksGrouped(lifecycleId);
    const calendar = await this.pg.workingCalendar();
    const now = new Date();
    const tasks: Record<string, ReturnType<ServiceLifecycleService['decorateTask']>[]> = {};
    const flat: ReturnType<ServiceLifecycleService['decorateTask']>[] = [];
    for (const stage of VALID_STAGES) {
      tasks[stage] = (grouped[stage] ?? []).map((row) => this.decorateTask(row, calendar.workingHours, now));
      flat.push(...tasks[stage]);
    }
    for (const [stage, rows] of Object.entries(grouped)) {
      if (tasks[stage]) continue;
      tasks[stage] = rows.map((row) => this.decorateTask(row, calendar.workingHours, now));
      flat.push(...tasks[stage]);
    }
    const ops = summarizeDeliveryOps(
      flat.map((row) => ({
        work_status: row.work_status,
        due_date: row.due_date,
        done_at: row.done_at || null,
        quote_hours: row.quote_hours,
        actual_hours: row.actual_hours,
        assignee: row.assignee,
        assignee_staff_id: row.assignee_staff_id,
      })),
      calendar.workingHours,
      now,
    );
    return { tasks, ops };
  }

  private async recomputeTaskDues(lifecycleId: number, fromTaskId: number): Promise<void> {
    const grouped = await this.tasksPg.listTasksGrouped(lifecycleId);
    const flat = VALID_STAGES.flatMap((stage) => grouped[stage] ?? []);
    const startIdx = flat.findIndex((row) => row.id === fromTaskId);
    if (startIdx < 0) return;
    const calendar = await this.pg.workingCalendar();
    const stamps = await this.pg.lifecycleTimestamps(lifecycleId);
    const fallback = stamps.created_at ? new Date(stamps.created_at) : new Date();
    let cursor: Date = fallback;
    if (startIdx > 0) {
      const prev = flat[startIdx - 1];
      cursor = dueEndAt(String(prev.due_date ?? ''), calendar.workingHours) ?? fallback;
    }
    for (const row of flat.slice(startIdx)) {
      const hours = Number(row.form_data?.hours ?? row.quote_hours ?? 0);
      const qty = Number(row.form_data?.qty ?? 1);
      const due = computeDueYmd(
        cursor,
        hours,
        Number.isFinite(qty) && qty > 0 ? qty : 1,
        calendar.workingHours,
        calendar.holidays,
      );
      if (due && due !== row.due_date) {
        await this.tasksPg.updateTask(row.id, { due_date: due, form_data: { ...row.form_data, due_date: due } });
      }
      if (due) {
        cursor = dueEndAt(due, calendar.workingHours) ?? cursor;
      }
    }
  }

}
