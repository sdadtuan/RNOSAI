import { Optional, Inject, forwardRef, BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { canUseAssignedSolutionAction } from './solution-assignee-access.util';
import { MktAiPlannerAllowService } from '../marketing-ai-planner/mkt-ai-planner-allow.service';
import { extractHttpErrorMessage } from '../common/http-error.util';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { AppConfigService } from '../config/app-config.service';
import { CrmLeadsPgRepository } from '../crm-leads-legacy/crm-leads-pg.repository';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { parseB2CompletedAt } from '../cskh-board/cskh-board-sla.util';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { hasGdkdSolutionDesk } from '../staff-permissions/staff-gdkd.util';
import { maskPartialPii } from '../staff-permissions/field-level.serializer';
import { parseLeadMeta } from './care-pipeline.util';
import { showPresalesForFlow } from './lead-flow-kind.util';
import {
  AdvancePresalesBody,
  CompleteCareStageBody,
  ConsultPrefillBody,
  EnsurePresalesBody,
  HandoffSolutionBody,
  LeadFunnelSnapshot,
  PatchMarketingPlanBody,
  PatchClientBriefBody,
  PatchPresalesL2DocsBody,
  PatchPresalesTaskBody,
  PresalesAiAssistBody,
  PresalesConsultSlaReminderBody,
  ReleaseReviewQueueBody,
  UpgradePresalesWorkflowBody,
  BatchUpgradePresalesWorkflowBody,
} from './leads-funnel.types';
import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';
import { parseQuoteServiceCodes } from './quote-sheet.util';
import { isCeoPosition } from './quote-case.util';
import { isAccountManagerPosition, isMarketingLeaderPosition } from '../b2b-projects/b2b-director.util';
import { canWriteLeadContract, CONTRACT_AM_ONLY_MESSAGE } from '../leads-contract/contract-writer.util';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';
import { validatePreliminaryPlan, planContentFromRow, defaultStrategyJson, STRATEGY_FRAMEWORK_KEYS, hasCompletedSolutionPack, preliminaryPlanHasSolutionFile } from './presales-marketing-plan.util';
import { sessionHasCompleteDiscovery } from '../intake/sales-discovery.util';
import { buildPresalesConsultBrief } from './presales-consult-brief.util';
import {
  buildPresalesAiPromptContext,
  formatPresalesAiPrompt,
} from './presales-ai-prompt.util';
import { briefFieldFilled, clientBriefMissing, clientBriefPayload, leadQualifyFacts, prefillClientBriefFromTasks, readClientBrief, resolveLeadNiche, writeClientBrief } from './client-plan-brief.util';
import { fetchClientPlanSources } from './client-plan-source.util';
import { buildClientPlanDraftCall,
  humanEditedR5Fields,
  mergeClientPlanModelDraft,
  selectClientPlanModel,
} from './client-plan-draft.util';
import { buildConsultFactsSuggestCall, normalizeConsultFactsSuggest } from './consult-facts-suggest.util';
import { clientPlanExportFilename } from './client-plan-deck.util';
import { convertClientPlanPdf, findSoffice } from './client-plan-pptx.util';
import { renderClientPlanFromTemplate } from './client-plan-template.util';
import { buildProposalAdvanceGate } from './presales-proposal-gate.util';
import { buildPresalesProposalHandoff } from './presales-proposal-handoff.util';
import { buildL1GateChecklist } from './presales-l1-gate-checklist.util';
import { SERVICE_LABELS } from '../leads-contract/lifecycle-workflow-steps.util';
import { IntakeService } from '../intake/intake.service';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import {
  assertPresalesConsultTaskDone,
  validatePresalesConsultTaskDone,
} from './presales-consult-task-gate.util';
import { mergePresalesFormData } from './presales-task-form.util';
import { assertPresalesL2DocsComplete } from './presales-l2-docs.util';
import { reviewQueuePublicState } from './review-queue.util';
import {
  assertCanAdvanceConsultToProposal,
  assertCanMutatePresalesConsult,
} from './presales-solution-rbac.util';
import {
  buildSolutionHandoffActivity,
  SOLUTION_HANDOFF_ACTIVITY_TYPES,
  type SolutionHandoffActivityType,
} from './presales-solution-handoff-activity.util';
import { buildReviewQueueMetrics } from './review-queue-metrics.util';
import { buildReviewQueueAiSummary, computeReviewQueuePriority } from './review-queue-intelligence.util';
import {
  buildBatchUpgradeCsvHeader,
  cohortCsvRow,
  resolveBatchUpgradeStages,
  type BatchUpgradePresalesWorkflowResult,
} from './presales-workflow-batch.util';
import { ReviewQueueLlmService } from './review-queue-llm.service';
import { PolicyService } from '../policy/policy.service';
import {
  clearPresalesAiDraftMeta,
  parsePresalesAiDraftMeta,
  parseTargetMarketProfJson,
  PRESALES_AI_DRAFT_BADGE_VI,
  stampPresalesAiDraftMeta,
} from './presales-ai-draft-meta.util';
import { loadSolutionAiContext } from './solution-ai-context.loader';
import {
  CONTRACT_DOCX_MIME,
  DEAL_FILE_MAX_BYTES,
  detectDealUpload,
  QUOTE_XLSX_MIME,
  safeDealFileName,
  type DealFileKind,
} from './lead-deal-files.util';
import {
  QUOTE_KPI_AI_TIMEOUT_MS,
  QUOTE_KPI_SYSTEM_PROMPT,
  buildQuoteKpiUserPrompt,
  getCachedQuoteKpis,
  parseQuoteKpiAiJson,
  quoteKpiCacheKey,
  setCachedQuoteKpis,
} from './quote-estimated-kpi-ai.util';
import {
  buildSolutionAiDraftCall,
  emptySolutionAiSections,
  mergeSolutionAiIntoStrategy,
  normalizeSolutionAiSections,
  packSolutionAi,
  parseSolutionAiFromStrategy,
  SOLUTION_AI_NOT_CONFIGURED,
  SOLUTION_AI_PENDING_LABEL,
} from './solution-ai-draft.util';
import {
  postSolutionAiWebhook,
  readSolutionAgentConfig,
  signSolutionAiPayload,
  verifySolutionAiSignature,
} from './solution-ai-agent.util';
import { randomUUID } from 'crypto';
import { rejectMktAiAutoCustomerEmail } from '../marketing-ai-planner/mkt-ai-governance.util';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepRepository } from '../lead-meeting-prep/lead-meeting-prep.repository';
import {
  applyLmpDvCodesToConsultPrefill,
  extractLmpConsultMergeFields,
  mergeLmpIntoConsultBrief,
} from '../lead-meeting-prep/lmp-consult-merge.util';
import type { B2bListScope } from '../b2b-projects/b2b-lead-scope.service';
import { B2bManualReassignService } from '../b2b-projects/b2b-manual-reassign.service';
import { LeadsRepository } from '../leads/leads.repository';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { SOLUTION_ACCEPT_MINUTES } from './solution-case.util';
import { TeamSlaService } from '../team-sla/team-sla.service';
import {
  caseStaffNotify,
  salesNotifyStaffIds,
  type CaseNotifyPayload,
} from './case-staff-notify.util';

@Injectable()
export class LeadsFunnelService {
  constructor(
    private readonly pgRepo: LeadsFunnelPgRepository,
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly leadPg: CrmLeadsPgRepository,
    private readonly cskhBoard: CskhBoardService,
    private readonly reviewQueueLlm: ReviewQueueLlmService,
    @Inject(forwardRef(() => IntakeService))
    private readonly intake: IntakeService,
    private readonly llm: AiLlmClient,
    private readonly legacyLeads: CrmLeadsLegacyService,
    private readonly policy: PolicyService,
    private readonly mktAiAllow: MktAiPlannerAllowService,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
    private readonly lmpRepo: LeadMeetingPrepRepository,
    private readonly b2bManualReassign: B2bManualReassignService,
    private readonly leadsRepo: LeadsRepository,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly notifications: StaffNotificationsRepository,
    @Optional() private readonly teamSla?: TeamSlaService,
  ) {}


  private async marketingClaimMinutes(): Promise<number> {
    try {
      const n = await this.teamSla?.marketingClaimMinutes();
      return n != null && Number.isFinite(n) && n >= 0 ? n : SOLUTION_ACCEPT_MINUTES;
    } catch {
      return SOLUTION_ACCEPT_MINUTES;
    }
  }

  private async saleMissingInfoHours(): Promise<number> {
    try {
      const n = await this.teamSla?.saleMissingInfoHours();
      return n != null && Number.isFinite(n) && n >= 0 ? n : 1;
    } catch {
      return 1;
    }
  }

  /** Public so Discovery submit (intake) can notify the same AM desk as the handoff API. */
  async notifyAmSolutionHandoff(leadId: number): Promise<void> {
    const payload = caseStaffNotify({ kind: 'submitted_to_am', leadId });
    const notifiedUsers = new Set<string>();
    const staffIds = await this.pgRepo.amDeskStaffIds();
    const staffUserIds = await Promise.all(
      staffIds.map((staffId) => this.notifications.notifyStaff(staffId, payload).catch(() => null)),
    );
    for (const userId of staffUserIds) {
      if (userId) notifiedUsers.add(String(userId));
    }
    // Auth users on the AM desk that do not map to a crm_staff row already notified.
    const userIds = await this.pgRepo.solutionDeskAuthUserIds();
    await Promise.all(
      userIds.map((userId) => {
        const uid = String(userId ?? '').trim();
        if (!uid || notifiedUsers.has(uid)) return Promise.resolve();
        return this.notifications
          .create({
            user_id: uid,
            ...payload,
          })
          .catch(() => undefined);
      }),
    );
  }

  async notifyAfterHandoffToSolution(
    leadId: number,
    handed?: { handoff_status?: string | null; solution_owner_staff_id?: number | null },
  ): Promise<void> {
    if (handed?.handoff_status === 'with_solution' && handed.solution_owner_staff_id) {
      await this.notifyResponsible(
        handed.solution_owner_staff_id,
        caseStaffNotify({ kind: 'auto_reclaim_solution', leadId }),
      );
      return;
    }
    // Auto-assigned (or already assigned) Solution owner from the pool: notify only that person.
    const owner = Number(handed?.solution_owner_staff_id ?? 0);
    if (handed?.handoff_status === 'pending' && owner > 0 && (await this.pgRepo.isSolutionPoolMember(owner))) {
      await this.notifyResponsible(owner, caseStaffNotify({ kind: 'solution_assigned', leadId }));
      return;
    }
    await this.notifyAmSolutionHandoff(leadId);
  }

  private async notifyResponsible(
    staffId: number | null | undefined,
    payload: CaseNotifyPayload,
  ): Promise<void> {
    if (staffId == null || !Number.isFinite(Number(staffId)) || Number(staffId) <= 0) return;
    await this.notifications.notifyStaff(Number(staffId), payload).catch(() => undefined);
  }

  /** Notify the lead's Sales owner / submitter — never the AM who just acted. */
  private async notifyLeadSales(
    leadId: number,
    handedOffBy: number | null | undefined,
    actorStaffId: number | null | undefined,
    payload: CaseNotifyPayload,
  ): Promise<void> {
    const [owner, amIds] = await Promise.all([
      this.pgRepo.leadOwnerStaffId(leadId),
      this.pgRepo.accountManagerStaffIds(),
    ]);
    const ids = salesNotifyStaffIds({
      handedOffBy,
      leadOwner: owner,
      actorStaffId,
      accountManagerStaffIds: amIds,
    });
    for (const id of ids) {
      await this.notifyResponsible(id, payload);
    }
  }

  async markSolutionViewed(leadId: number, staffId: number | null, actor: string, staffUser?: StaffJwtPayload) {
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    if (String(snap.presales.handoff_status ?? '').trim() !== 'released') {
      return { ok: true, funnel: await this.getFunnel(leadId), already: true };
    }
    const existing = await this.pgRepo.hasSolutionViewActivity(leadId);
    if (existing) {
      return { ok: true, funnel: await this.getFunnel(leadId), already: true };
    }
    await this.logSolutionHandoffActivity(
      leadId,
      SOLUTION_HANDOFF_ACTIVITY_TYPES.viewed,
      actor,
      staffId,
      staffUser,
    );
    return { ok: true, funnel: await this.getFunnel(leadId), already: false };
  }

  async getFunnel(leadId: number): Promise<LeadFunnelSnapshot> {
    const snap = await this.pgRepo.buildSnapshot(leadId, this.config.presalesOnLead);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    return { ...snap, presales_ai_configured: Boolean(this.aiConfig.llmApiKey) };
  }

  /** Per-viewer: may this user use AI tạo Solution / Nộp on this lead (same rule as the API guards)? */
  async solutionAccess(leadId: number, staffUser?: StaffJwtPayload, internal = false) {
    const assigneeStaffId = await this.pgRepo.solutionAssigneeStaffId(leadId);
    const assigneeName = assigneeStaffId
      ? (await this.leadPg.staffNamesByIds([assigneeStaffId])).get(assigneeStaffId) ?? null
      : null;
    let canAct = internal;
    let isSuperAdmin = false;
    if (!internal && staffUser) {
      isSuperAdmin = await this.staffAuth.isSuperAdminUser(staffUser);
      if (isSuperAdmin) {
        canAct = true;
      } else {
        const [staffId, me, canReceiveSolution] = await Promise.all([
          this.staffAuth.resolveCrmStaffUserId(staffUser),
          this.staffAuth.me(staffUser),
          this.staffAuth.canReceiveSolution(staffUser),
        ]);
        canAct = canUseAssignedSolutionAction({
          staffId,
          assigneeStaffId,
          isAccountManager: isAccountManagerPosition(me.position_code),
          canReceiveSolution,
        });
      }
    }
    return {
      ok: true,
      can_act: canAct,
      is_super_admin: isSuperAdmin,
      assignee_staff_id: assigneeStaffId,
      assignee_name: assigneeName,
      reason: canAct ? '' : 'Chỉ người được giao Solution',
    };
  }

  async getCarePipeline(leadId: number) {
    const snap = await this.getFunnel(leadId);
    return { ok: true, ...snap.care_pipeline, presales_care_gate: snap.presales_care_gate };
  }

  private funnelError(err: unknown): never {
    if (
      err instanceof NotFoundException ||
      err instanceof ForbiddenException ||
      err instanceof BadRequestException
    ) {
      throw err;
    }
    const msg = extractHttpErrorMessage(err);
    throw new BadRequestException(msg);
  }

  private async staffCapContext(staffUser?: StaffJwtPayload) {
    if (!staffUser) return { caps: [], gdkdAssign: false, job_functions: [] as string[], permission_sets: [] as string[] };
    const me = await this.staffAuth.me(staffUser);
    return {
      caps: me.caps,
      gdkdAssign: hasGdkdSolutionDesk(me.caps),
      job_functions: me.job_functions ?? [],
      permission_sets: me.permission_sets ?? [],
      canReceiveSolution: await this.staffAuth.canReceiveSolution(staffUser),
    };
  }

  private async buildPresalesPolicyContext(
    leadId: number,
    action: 'release' | 'claim',
    staffUser?: StaffJwtPayload,
  ) {
    const staffCtx = await this.staffCapContext(staffUser);
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    const curProg = snap.progress.consult || { total: 0, done: 0 };
    const consultComplete = curProg.total === 0 || curProg.done >= curProg.total;
    const plan = await this.pgRepo.getPreliminaryPlan(snap.presales.id);
    const planVal = validatePreliminaryPlan(plan);
    const packDone = hasCompletedSolutionPack(plan);
    const hasHandoff = await this.pgRepo.hasSolutionHandoffActivity(leadId, snap.presales.handed_off_at);
    const intakeRows = await this.pgRepo.listIntakeAnswersForLead(leadId);
    const hasCompleteDiscovery = intakeRows.some((row) => sessionHasCompleteDiscovery(row.answers_json));
    // New flow = Sales Discovery Submit (handoff stamped) + Giao (with_solution / pending).
    const discoveryHandoffFlow =
      hasCompleteDiscovery &&
      Boolean(snap.presales.handed_off_at) &&
      (snap.presales.handoff_status === 'with_solution' ||
        snap.presales.handoff_status === 'pending' ||
        snap.presales.handoff_status === 'released');
    const hasSolutionFile = preliminaryPlanHasSolutionFile(plan) || packDone;
    let positionCode: string | null = null;
    if (staffUser) {
      const me = await this.staffAuth.me(staffUser);
      positionCode = me.position_code ?? null;
    }
    return {
      action,
      gdkd_assign: staffCtx.gdkdAssign,
      job_functions: staffCtx.job_functions,
      permission_sets: staffCtx.permission_sets,
      position_code: positionCode,
      can_receive_solution: staffUser
        ? await this.staffAuth.canReceiveSolution(staffUser)
        : false,
      handoff_status: snap.presales.handoff_status,
      has_handoff_activity: hasHandoff,
      consult_complete: consultComplete || packDone,
      preliminary_plan_ok: planVal.ok || packDone,
      discovery_handoff_flow: discoveryHandoffFlow,
      has_solution_file: hasSolutionFile,
    };
  }

  async previewPresalesPolicy(
    leadId: number,
    action: 'release' | 'claim',
    staffUser?: StaffJwtPayload,
  ) {
    await this.getFunnel(leadId);
    if (await this.actorIsSuperAdmin(staffUser)) {
      return this.policy.preview(action, {
        gdkd_assign: true,
        job_functions: [],
        permission_sets: [],
        handoff_status: action === 'claim' ? 'pending' : 'with_solution',
        has_handoff_activity: true,
        consult_complete: true,
        preliminary_plan_ok: true,
      });
    }
    const ctx = await this.buildPresalesPolicyContext(leadId, action, staffUser);
    const { action: _ignored, ...rest } = ctx;
    return this.policy.preview(action, rest);
  }


  private async actorPositionCode(staffUser?: StaffJwtPayload): Promise<string> {
    if (!staffUser) return '';
    try {
      const me = await this.staffAuth.me(staffUser);
      return String(me.position_code ?? '');
    } catch {
      return '';
    }
  }

  private async assertCeoOrAdmin(staffUser?: StaffJwtPayload): Promise<void> {
    if (await this.actorIsSuperAdmin(staffUser)) return;
    const code = await this.actorPositionCode(staffUser);
    if (isCeoPosition(code)) return;
    throw new ForbiddenException({ error: 'Chỉ CEO được duyệt hoặc từ chối báo giá.' });
  }

  private async quoteSheetAccess(
    staffUser?: StaffJwtPayload,
  ): Promise<{ allowUnapproved: boolean; isSales: boolean; asPrivileged: boolean }> {
    if (await this.actorIsSuperAdmin(staffUser)) {
      return { allowUnapproved: true, isSales: false, asPrivileged: true };
    }
    const code = await this.actorPositionCode(staffUser);
    if (isCeoPosition(code) || isSuperAdminPositionCode(code)) {
      return { allowUnapproved: true, isSales: false, asPrivileged: true };
    }
    if (isAccountManagerPosition(code) || isMarketingLeaderPosition(code)) {
      return { allowUnapproved: true, isSales: false, asPrivileged: false };
    }
    return { allowUnapproved: false, isSales: true, asPrivileged: false };
  }

  private async notifyCeos(leadId: number): Promise<void> {
    const payload = caseStaffNotify({ kind: 'quote_submitted_ceo', leadId });
    const notified = new Set<string>();
    // CEO position plus SUPER-ADMIN (UAT has no dedicated CEO stub; admin is the CEO actor).
    // Do not skip a recipient because they are also the AM who sent the quote.
    const staffIds = await this.pgRepo.ceoDeskStaffIds();
    for (const staffId of staffIds) {
      const userId = await this.notifications.notifyStaff(staffId, payload).catch(() => null);
      if (userId) notified.add(String(userId));
    }
    const userIds = await this.pgRepo.ceoAuthUserIds();
    for (const userId of userIds) {
      const uid = String(userId ?? '').trim();
      if (!uid || notified.has(uid)) continue;
      await this.notifications
        .create({
          user_id: uid,
          kind: payload.kind,
          title: payload.title,
          body: payload.body,
          link_href: payload.link_href,
          meta_json: payload.meta_json,
        })
        .catch(() => undefined);
    }
  }

  private async actorIsSuperAdmin(staffUser?: StaffJwtPayload): Promise<boolean> {
    if (!staffUser) return false;
    return this.staffAuth.isSuperAdminUser(staffUser);
  }

  private async assertPresalesPolicy(
    leadId: number,
    action: 'release' | 'claim',
    staffUser?: StaffJwtPayload,
  ): Promise<void> {
    if (staffUser && (await this.staffAuth.isSuperAdminUser(staffUser))) return;
    const ctx = await this.buildPresalesPolicyContext(leadId, action, staffUser);
    this.policy.assertAllow(ctx);
  }

  private async assertConsultMutationAllowed(
    leadId: number,
    staffUser: StaffJwtPayload | undefined,
    taskStage?: string,
  ): Promise<void> {
    if (taskStage && taskStage !== 'consult') return;
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    if (!snap) return;
    const { caps, gdkdAssign, canReceiveSolution } = await this.staffCapContext(staffUser);
    assertCanMutatePresalesConsult(
      caps,
      snap.presales.handoff_status,
      snap.presales.stage,
      { gdkdAssign, canReceiveSolution },
    );
  }

  async submitCareReport(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
    userId: number | null,
  ) {
    try {
      await this.pgRepo.submitCareReport(leadId, body, actor, userId);
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async completeCareStage(leadId: number, body: CompleteCareStageBody, actor: string) {
    try {
      await this.pgRepo.completeCareStage(leadId, body, actor);
    } catch (err) {
      this.funnelError(err);
    }
    await this.maybeAutoEnsurePresalesAfterB2(leadId, body, actor);
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  /** B2 (first_contact) xong → tạo pre-sales luôn, không cần nút "Bắt đầu pre-sales". */
  private async maybeAutoEnsurePresalesAfterB2(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
  ): Promise<void> {
    if (!this.config.presalesOnLead) return;
    const stage = String(body.stage || 'first_contact').trim() || 'first_contact';
    if (stage !== 'first_contact') return;

    const funnel = await this.getFunnel(leadId);
    if (!showPresalesForFlow(funnel.lead_flow_kind)) return;
    if (!funnel.presales_care_gate.complete) return;
    if (funnel.presales) return;

    const slug =
      String(body.service_slug || '').trim() || 'dich-vu-seo-tong-the';
    try {
      await this.pgRepo.ensurePresales(leadId, slug, actor);
    } catch (err) {
      this.funnelError(err);
    }
  }

  async reviewQueueCount(b2bListScope?: B2bListScope): Promise<{ count: number }> {
    const count = await this.pgRepo.countReviewQueue(b2bListScope);
    return { count };
  }

  async reviewQueueMetrics(limit = 500, b2bListScope?: B2bListScope) {
    const listed = await this.listReviewQueue(limit, b2bListScope);
    return buildReviewQueueMetrics(
      listed.leads.map((row) => ({ hours_waiting: row.review_queue.hours_waiting })),
    );
  }

  async listReviewAssignees(): Promise<{ staff: Array<{ id: number; name: string }> }> {
    const staff = await this.pgRepo.listReviewAssignees();
    return { staff };
  }

  async listReviewQueue(limit?: number, b2bListScope?: B2bListScope) {
    const rows = await this.pgRepo.listReviewQueue(limit, b2bListScope);
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
  async listReviewQueueAiSummaries(
    limit?: number,
    mode?: 'rules' | 'llm',
    b2bListScope?: B2bListScope,
  ) {
    const rows = await this.pgRepo.listReviewQueue(limit, b2bListScope);
    const ids = rows.map((r) => Number(r.id));
    const firstCalls = await this.leadPg.firstCallAtByLeadIds(ids);
    const ownerIds = rows.map((r) => Number(r.owner_id ?? 0)).filter((id) => id > 0);
    const ownerNames = await this.leadPg.staffNamesByIds(ownerIds);

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
    return this.pgRepo.syncReviewQueue(actor, dryRun);
  }

  async releaseReviewQueue(leadId: number, body: ReleaseReviewQueueBody, actor: string) {
    try {
      const existing = await this.leadsRepo.getLeadById(leadId);
      const b2bManual = existing && this.b2bManualReassign.requiresSplitChoice(existing);
      if (b2bManual && !body.split) {
        throw new BadRequestException({ error: 'split_required' });
      }

      const releaseMeta = await this.pgRepo.releaseFromReviewQueue(leadId, body, actor);

      if (b2bManual && existing?.b2b_project_id) {
        const toOwnerId =
          releaseMeta?.targetOwner ??
          (body.mode === 'manual' && body.owner_id ? Number(body.owner_id) : Number(existing.owner_id));
        if (toOwnerId) {
          await this.b2bManualReassign.applyManualOwnerChange({
            leadId,
            projectId: String(existing.b2b_project_id),
            fromOwnerId:
              releaseMeta?.fromOwnerId ??
              (existing.owner_id != null ? Number(existing.owner_id) : null),
            toOwnerId,
            split: body.split!,
            reason: body.note?.trim() || 'gdkd_release',
            skipOwnerUpdate: true,
          });
        }
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
      await this.pgRepo.ensurePresales(leadId, body.service_slug, actor);
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getConsultAdvanceGate(leadId: number) {
    const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
    if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
    const gate = await this.pgRepo.buildConsultAdvanceGate(leadId, ps.id);
    return { ok: true, gate, presales_stage: ps.stage };
  }

  async advancePresales(
    leadId: number,
    body: AdvancePresalesBody,
    allowOverride = false,
    staffUser?: StaffJwtPayload,
  ) {
    try {
      const snap = await this.pgRepo.getPresalesSnapshot(leadId);
      if (
        snap?.advance.next_stage === 'proposal' &&
        snap.advance.current_stage === 'consult'
      ) {
        const { caps, gdkdAssign, canReceiveSolution } = await this.staffCapContext(staffUser);
        assertCanAdvanceConsultToProposal(caps, snap.presales.handoff_status, { gdkdAssign, canReceiveSolution });
      }
      await this.pgRepo.advancePresales(leadId, {
        confirm: Boolean(body.confirm),
        overrideReason: body.override_reason,
        allowOverride,
      });
    } catch (err) {
      this.funnelError(err);
    }
    await this.maybeEnqueueM3Prep(leadId);
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  private async maybeEnqueueM3Prep(leadId: number): Promise<void> {
    if (!this.lmpEnqueue.isEnabled()) return;
    try {
      const gateResp = await this.getPresalesProposalGate(leadId);
      if (!gateResp.gate.ok) return;
      await this.lmpEnqueue.enqueueAfterProposalGatePass(leadId);
    } catch {
      /* optional hook */
    }
  }

  async listSolutionQueue(
    status?: string,
    limit?: number,
    opts: { ownerStaffId?: number | null; includeAmRework?: boolean } = {},
  ) {
    const statuses: Array<'pending' | 'with_solution'> =
      status === 'pending' || status === 'with_solution'
        ? [status]
        : ['pending', 'with_solution'];
    const includeAmRework = Boolean(opts.includeAmRework) && !status;
    const rows = await this.pgRepo.listSolutionQueue(statuses, limit, {
      ownerStaffId: opts.ownerStaffId,
      includeAmRework,
    });
    return { ok: true, rows, count: rows.length };
  }

  private async resolveStaffDisplayName(
    staffUser: StaffJwtPayload | undefined,
    actor: string,
    staffId: number | null,
  ): Promise<string> {
    const fromJwt = String(staffUser?.display_name ?? '').trim();
    if (fromJwt) return fromJwt;
    if (staffId) {
      const name = (await this.leadPg.staffNamesByIds([staffId])).get(staffId);
      if (name) return name;
    }
    return actor;
  }

  private async logSolutionHandoffActivity(
    leadId: number,
    kind: SolutionHandoffActivityType,
    actor: string,
    staffId: number | null,
    staffUser?: StaffJwtPayload,
    returnReason?: string,
    extra?: { fileName?: string; deadlineLabel?: string; actorName?: string },
  ): Promise<void> {
    // History is best-effort: the action it describes has already been saved, so a failed
    // history write must not turn a successful upload / AI draft / Nộp into an error.
    try {
      await this.writeSolutionHandoffActivity(leadId, kind, actor, staffId, staffUser, returnReason, extra);
    } catch (err) {
      const res = err instanceof BadRequestException ? err.getResponse() : null;
      const code =
        res && typeof res === 'object' && !Array.isArray(res)
          ? String((res as { code?: unknown }).code ?? '')
          : '';
      if (code === 'activity_duplicate') return;
      new Logger(LeadsFunnelService.name).warn(
        `Solution history not recorded lead=${leadId} kind=${kind}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async writeSolutionHandoffActivity(
    leadId: number,
    kind: SolutionHandoffActivityType,
    actor: string,
    staffId: number | null,
    staffUser?: StaffJwtPayload,
    returnReason?: string,
    extra?: { fileName?: string; deadlineLabel?: string; actorName?: string },
  ): Promise<void> {
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    if (!snap) return;

    let amOwnerName: string | undefined;
    if (kind === SOLUTION_HANDOFF_ACTIVITY_TYPES.released && snap.presales.assigned_am) {
      amOwnerName = (await this.leadPg.staffNamesByIds([snap.presales.assigned_am])).get(
        snap.presales.assigned_am,
      );
    }

    const payload = buildSolutionHandoffActivity(kind, {
      leadId,
      serviceSlug: snap.presales.service_slug,
      actorName:
        extra?.actorName?.trim() ||
        (await this.resolveStaffDisplayName(staffUser, actor, staffId)),
      amOwnerName,
      returnReason,
      fileName: extra?.fileName,
      deadlineLabel: extra?.deadlineLabel,
    });
    await this.legacyLeads.createActivity(leadId, payload, actor, staffId);
  }

  private marketingPlanFileNames(plan: { strategy_framework_json?: unknown; strategy_framework?: unknown } | null | undefined): string[] {
    const raw = plan?.strategy_framework_json ?? plan?.strategy_framework;
    const packed =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? String((raw as { mkt_files?: unknown }).mkt_files ?? '')
        : '';
    const text = packed || (typeof raw === 'string' ? raw : '');
    try {
      const parsed = text.trim().startsWith('[')
        ? (JSON.parse(text) as unknown)
        : raw && typeof raw === 'object'
          ? JSON.parse(String((raw as { mkt_files?: unknown }).mkt_files ?? '[]'))
          : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => (row && typeof row === 'object' ? String((row as { name?: string }).name ?? '').trim() : ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async handoffToSolution(
    leadId: number,
    body: HandoffSolutionBody,
    staffId: number | null,
    actor: string,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) {
      const email = staffUser?.email?.trim() || '';
      throw new BadRequestException(
        email
          ? `Tài khoản ${email} chưa có hồ sơ CRM (crm_staff) — liên hệ Admin HR để thêm nhân sự.`
          : 'Thiếu staff id — đăng nhập lại.',
      );
    }
    try {
      const loaded = await this.loadClientBrief(leadId);
      const missing = clientBriefMissing(loaded.brief, {
        company_name: loaded.company_name,
        niche: loaded.niche,
        need: loaded.need,
      });
      if (missing.length) {
        throw new BadRequestException({
          error: 'client_brief_incomplete',
          message: missing.join('; '),
          details: missing,
        });
      }
      const acceptMinutes = await this.marketingClaimMinutes();
      const handed = await this.pgRepo.handoffToSolution(leadId, staffId, {
        confirm: Boolean(body.confirm),
        overrideReason: body.override_reason,
        acceptMinutes,
      });
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff,
        actor,
        staffId,
        staffUser,
      );
      void this.notifyAfterHandoffToSolution(leadId, handed).catch(() => undefined);
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async listImplementationQueue(status?: string, limit?: number) {
    const st = String(status ?? 'pending').trim().toLowerCase();
    const filter =
      st === 'claimed' || st === 'all' ? (st as 'claimed' | 'all') : 'pending';
    const rows = await this.pgRepo.listImplementationQueue(filter, limit);
    return { ok: true, rows, count: rows.length };
  }

  async claimImplementationHandoff(
    leadId: number,
    staffId: number | null,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      await this.pgRepo.claimImplementationHandoff(
        leadId,
        staffId,
        await this.actorIsSuperAdmin(staffUser),
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async claimSolution(
    leadId: number,
    staffId: number | null,
    actor: string,
    staffUser?: StaffJwtPayload,
    opts?: { assigneeStaffId?: number; dueAt?: string; note?: string },
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    await this.assertPresalesPolicy(leadId, 'claim', staffUser);
    try {
      const claimed = await this.pgRepo.claimSolution(
        leadId,
        staffId,
        await this.actorIsSuperAdmin(staffUser),
        opts,
      );
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.claimed,
        actor,
        staffId,
        staffUser,
      );
      const assignee = claimed?.solution_owner_staff_id;
      if (assignee && assignee !== staffId) {
        void this.notifyResponsible(
          assignee,
          caseStaffNotify({ kind: 'assigned_to_marketing', leadId }),
        );
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async returnToSalesForMissingInfo(
    leadId: number,
    staffId: number | null,
    reason: string,
    actor: string,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      const missingInfoHours = await this.saleMissingInfoHours();
      const returned = await this.pgRepo.returnToSalesForMissingInfo(leadId, staffId, reason, {
        missingInfoHours,
      });
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.returned,
        actor,
        staffId,
        staffUser,
        reason,
      );
      await this.notifyLeadSales(
        leadId,
        returned.handed_off_by_staff_id,
        staffId,
        caseStaffNotify({ kind: 'return_missing_info', leadId, reason }),
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async releaseToSales(
    leadId: number,
    staffId: number | null,
    actor: string,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    // t163: Nộp Solution no longer runs the pre-sales release policy (it demanded handoff_status
    // 'with_solution' + Consult/plan checks and showed "Lead chưa đủ điều kiện…"). Who may submit is
    // still enforced by StaffPresalesSolutionReleaseGuard and the assigned AM / owner check in the repo.
    // SUPER-ADMIN keeps full access: the release guard lets them through, so the repository's
    // "assigned AM / Solution owner only" check must not reject them either.
    const superAdmin = Boolean(staffUser && (await this.staffAuth.isSuperAdminUser(staffUser)));
    try {
      const released = await this.pgRepo.releaseToSales(leadId, staffId, { superAdmin });
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.released,
        actor,
        staffId,
        staffUser,
      );
      await this.notifyLeadSales(
        leadId,
        released.handed_off_by_staff_id,
        staffId,
        caseStaffNotify({ kind: 'release_to_sales', leadId }),
      );
      const salesId = await this.pgRepo.leadOwnerStaffId(leadId);
      const salesName = salesId
        ? (await this.leadPg.staffNamesByIds([salesId])).get(salesId)
        : '';
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.received,
        actor,
        salesId ?? staffId,
        staffUser,
        undefined,
        { actorName: salesName || 'Sales' },
      );
      const amIds = await this.pgRepo.amDeskStaffIds();
      const salesIds = new Set(
        salesNotifyStaffIds({
          handedOffBy: released.handed_off_by_staff_id,
          leadOwner: await this.pgRepo.leadOwnerStaffId(leadId),
          actorStaffId: staffId,
          accountManagerStaffIds: amIds,
        }),
      );
      for (const amId of amIds) {
        if (!amId || amId === staffId || salesIds.has(amId)) continue;
        void this.notifyResponsible(
          amId,
          caseStaffNotify({ kind: 'released_to_am', leadId }),
        );
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async approveSubmittedSolution(leadId: number, staffId: number | null) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      await this.pgRepo.approveSubmittedSolution(leadId, staffId);
      const afterAgree = await this.pgRepo.getPresalesSnapshot(leadId);
      const amId =
        afterAgree?.presales.quote_assignee_staff_id ??
        afterAgree?.presales.solution_owner_staff_id ??
        afterAgree?.presales.last_solution_owner_staff_id ??
        null;
      void this.notifyResponsible(
        amId,
        caseStaffNotify({ kind: 'customer_agreed_solution', leadId }),
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async requestSolutionEdits(leadId: number, staffId: number | null, note: string) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      await this.pgRepo.requestSolutionEdits(leadId, staffId, note);
      const afterEdits = await this.pgRepo.getPresalesSnapshot(leadId);
      void this.notifyResponsible(
        afterEdits?.presales.solution_owner_staff_id,
        caseStaffNotify({ kind: 'request_solution_edits', leadId, reason: note }),
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  private isInternalNoteActivity(activity: { activity_type?: string; result?: string }): boolean {
    const type = String(activity.activity_type ?? '').trim().toLowerCase();
    const result = String(activity.result ?? '').trim().toLowerCase();
    return type === 'internal_note' || (type === 'note' && result === 'internal');
  }

  async listInternalNotes(leadId: number) {
    const activities = await this.legacyLeads.listActivities(leadId, 200);
    const notes = activities.filter((row) => this.isInternalNoteActivity(row));
    return { ok: true, notes };
  }

  async addInternalNote(
    leadId: number,
    content: string,
    staffId: number | null,
    actor: string,
    staffUser?: StaffJwtPayload,
  ) {
    const text = String(content ?? '').trim();
    if (!text) throw new BadRequestException({ error: 'Nhập nội dung ghi chú nội bộ.' });
    if (text.length < 2) throw new BadRequestException({ error: 'Ghi chú quá ngắn (tối thiểu 2 ký tự).' });
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    const { activity } = await this.legacyLeads.createActivity(
      leadId,
      { activity_type: 'note', content: text.slice(0, 4000), result: 'internal' },
      actor,
      staffId,
    );
    const preview = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    const author = (await this.resolveStaffDisplayName(staffUser, actor, staffId)) || actor;
    const payload = caseStaffNotify({
      kind: 'internal_note',
      leadId,
      reason: `${author}: ${preview}`,
    });
    const recipients = new Set<number>();
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    const owner = await this.pgRepo.leadOwnerStaffId(leadId);
    const candidates = [
      owner,
      snap?.presales.handed_off_by_staff_id,
      snap?.presales.solution_owner_staff_id,
      snap?.presales.last_solution_owner_staff_id,
      snap?.presales.quote_assignee_staff_id,
      snap?.presales.assigned_am,
    ];
    for (const id of candidates) {
      const n = Number(id ?? 0);
      if (Number.isFinite(n) && n > 0 && n !== staffId) recipients.add(n);
    }
    const superOnly = await this.pgRepo.superAdminStaffIds();
    for (const id of superOnly) {
      if (id && id !== staffId) recipients.add(id);
    }
    for (const id of recipients) {
      void this.notifyResponsible(id, payload);
    }
    const listed = await this.listInternalNotes(leadId);
    return { ok: true, activity, notes: listed.notes };
  }

  async updateSolutionDeadline(
    leadId: number,
    staffId: number | null,
    deadline: string,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    const handoff = String(snap.presales.handoff_status ?? '').trim();
    if (handoff !== 'pending' && handoff !== 'with_solution') {
      throw new BadRequestException({
        error: 'Chỉ sửa Deadline khi lead đang Chờ Solutions hoặc Đang làm Solutions.',
      });
    }
    const asSuper = await this.actorIsSuperAdmin(staffUser);
    const position = await this.actorPositionCode(staffUser);
    const isAm = isAccountManagerPosition(position);
    const isMkt = isMarketingLeaderPosition(position);
    const isOwner = Number(snap.presales.solution_owner_staff_id) === Number(staffId);
    if (!asSuper && !isAm && !(isMkt && (isOwner || handoff === 'with_solution'))) {
      throw new ForbiddenException({
        error: 'Chỉ AM, Marketing Leader hoặc Admin được sửa Deadline Solutions.',
      });
    }
    try {
      await this.pgRepo.updateSolutionDeadline(leadId, deadline);
      const raw = String(deadline ?? '').trim();
      const parsed = raw.length <= 10 ? new Date(`${raw}T17:00:00+07:00`) : new Date(raw);
      const deadlineLabel = Number.isNaN(parsed.getTime())
        ? raw
        : parsed.toLocaleDateString('vi-VN', { timeZone: 'Asia/Saigon' });
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.deadline,
        staffUser?.email || `staff:${staffId}`,
        staffId,
        staffUser,
        undefined,
        { deadlineLabel },
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async acceptQuoteCase(leadId: number, staffId: number | null, staffUser?: StaffJwtPayload) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      await this.pgRepo.acceptQuoteCase(leadId, staffId, await this.actorIsSuperAdmin(staffUser));
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async sendQuoteToSales(leadId: number, staffId: number | null, staffUser?: StaffJwtPayload) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      const asPrivileged =
        (await this.actorIsSuperAdmin(staffUser)) || isCeoPosition(await this.actorPositionCode(staffUser));
      await this.pgRepo.sendQuoteToSales(leadId, staffId, asPrivileged);
      await this.notifyCeos(leadId).catch(() => undefined);
      await this.attachQuoteExportOnSubmit(leadId, staffUser);
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async approveQuote(leadId: number, staffId: number | null, staffUser?: StaffJwtPayload) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    await this.assertCeoOrAdmin(staffUser);
    try {
      await this.pgRepo.approveQuote(leadId, staffId);
      const afterApprove = await this.pgRepo.getPresalesSnapshot(leadId);
      await this.notifyLeadSales(
        leadId,
        afterApprove?.presales.handed_off_by_staff_id,
        staffId,
        caseStaffNotify({ kind: 'quote_ceo_approved', leadId }),
      );
      const amId =
        afterApprove?.presales.quote_assignee_staff_id ??
        afterApprove?.presales.solution_owner_staff_id ??
        afterApprove?.presales.last_solution_owner_staff_id ??
        null;
      if (amId && amId !== staffId) {
        void this.notifyResponsible(
          amId,
          caseStaffNotify({ kind: 'quote_ceo_approved_am', leadId }),
        );
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async createQuoteContract(leadId: number, staffId: number | null, staffUser?: StaffJwtPayload) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    const asSuper = await this.actorIsSuperAdmin(staffUser);
    const position = await this.actorPositionCode(staffUser);
    if (
      !canWriteLeadContract({
        positionCode: position,
        asSuperAdmin: asSuper,
        actorStaffId: staffId,
        quoteAssigneeStaffId: snap?.presales.quote_assignee_staff_id,
        solutionOwnerStaffId: snap?.presales.solution_owner_staff_id,
        lastSolutionOwnerStaffId: snap?.presales.last_solution_owner_staff_id,
      })
    ) {
      throw new ForbiddenException({
        error: CONTRACT_AM_ONLY_MESSAGE,
        message: CONTRACT_AM_ONLY_MESSAGE,
      });
    }
    try {
      await this.pgRepo.createQuoteContract(leadId, staffId);
      const afterContract = await this.pgRepo.getPresalesSnapshot(leadId);
      await this.notifyLeadSales(
        leadId,
        afterContract?.presales.handed_off_by_staff_id,
        staffId,
        caseStaffNotify({ kind: 'contract_drafted', leadId }),
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async signQuoteContract(leadId: number, staffId: number | null) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      await this.pgRepo.signQuoteContract(leadId, staffId);
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getImplementationPlan(leadId: number) {
    try {
      return await this.pgRepo.getImplementationPlan(leadId);
    } catch (err) {
      this.funnelError(err);
    }
  }

  async requestQuoteEdits(leadId: number, staffId: number | null, note: string, staffUser?: StaffJwtPayload) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    await this.assertCeoOrAdmin(staffUser);
    try {
      await this.pgRepo.requestQuoteEdits(leadId, staffId, note);
      const afterQuote = await this.pgRepo.getPresalesSnapshot(leadId);
      void this.notifyResponsible(
        afterQuote?.presales.quote_assignee_staff_id,
        caseStaffNotify({ kind: 'quote_ceo_rejected', leadId, reason: note }),
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async transferQuoteCase(
    leadId: number,
    staffId: number | null,
    targetStaffId: number,
    positionCode: string | null | undefined,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    if (!isCeoPosition(positionCode) && !isSuperAdminPositionCode(positionCode)) {
      throw new ForbiddenException({ error: 'Chỉ CEO được chuyển case báo giá.' });
    }
    if (!Number.isInteger(targetStaffId) || targetStaffId <= 0) {
      throw new BadRequestException({ error: 'Chọn AM để chuyển.' });
    }
    try {
      await this.pgRepo.transferQuoteCase(leadId, staffId, targetStaffId);
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getQuoteSheet(leadId: number, services: string | undefined, staffUser?: StaffJwtPayload) {
    try {
      const codes = services === undefined ? null : parseQuoteServiceCodes(services);
      const access = await this.quoteSheetAccess(staffUser);
      return await this.pgRepo.getQuoteSheet(leadId, codes, access);
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getDeliveryKpi(leadId: number) {
    try {
      return await this.pgRepo.syncQuoteDeliveryKpi(leadId);
    } catch (err) {
      this.funnelError(err);
    }
  }

  async quoteSheetPdf(leadId: number, staffUser?: StaffJwtPayload): Promise<{ filename: string; buffer: Buffer }> {
    try {
      const access = await this.quoteSheetAccess(staffUser);
      await this.pgRepo.getQuoteSheet(leadId, null, access);
      return await this.pgRepo.quoteSheetPdf(leadId);
    } catch (err) {
      this.funnelError(err);
    }
  }

  async quoteSheetXlsx(leadId: number, staffUser?: StaffJwtPayload): Promise<{ filename: string; buffer: Buffer }> {
    try {
      const access = await this.quoteSheetAccess(staffUser);
      await this.assertCanDownloadDealFile(leadId, 'quote', access, staffUser);
      const existing = await this.pgRepo.latestExportDealFile(leadId, 'quote');
      if (existing?.storage_path) {
        return {
          filename: existing.file_name,
          buffer: this.pgRepo.readStoredDealFile(existing.storage_path),
        };
      }
      const view = await this.pgRepo.getQuoteSheet(leadId, null, access);
      const estimated = await this.estimateQuoteExportKpis(leadId, view);
      return await this.pgRepo.quoteSheetXlsx(leadId, estimated);
    } catch (err) {
      this.funnelError(err);
    }
  }

  private async estimateQuoteExportKpis(
    leadId: number,
    view: Awaited<ReturnType<LeadsFunnelPgRepository['getQuoteSheet']>>,
  ) {
    let briefText = '';
    let budgetLabel = '';
    let timelineLabel = '';
    let callNotes = '';
    let leadLabel = `Lead ${leadId}`;
    try {
      const ctx = await loadSolutionAiContext(this.config.databaseUrl, leadId);
      briefText = [ctx.discoveryText, ctx.serviceLinesText].filter(Boolean).join('\n');
      budgetLabel = ctx.budgetLabel || '';
      timelineLabel = ctx.timelineLabel || '';
      callNotes = ctx.callNotes || '';
      leadLabel = ctx.companyName || leadLabel;
    } catch {
      /* brief is optional; export still works */
    }
    const key = quoteKpiCacheKey(leadId, view, [briefText, budgetLabel, timelineLabel, callNotes].join('\n'));
    const hit = getCachedQuoteKpis(key);
    if (hit) return hit;
    try {
      const out = await this.llm.completeJson({
        systemPrompt: QUOTE_KPI_SYSTEM_PROMPT,
        userContent: buildQuoteKpiUserPrompt({
          leadLabel,
          briefText,
          budgetLabel,
          timelineLabel,
          callNotes,
          view,
        }),
        timeoutMs: QUOTE_KPI_AI_TIMEOUT_MS,
        stubJson: () => ({}),
      });
      if (out.stubMode) return null;
      const parsed = parseQuoteKpiAiJson(out.parsed);
      if (parsed) setCachedQuoteKpis(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async quoteContractDocx(leadId: number, staffUser?: StaffJwtPayload): Promise<{ filename: string; buffer: Buffer }> {
    try {
      const access = await this.quoteSheetAccess(staffUser);
      await this.assertCanDownloadDealFile(leadId, 'contract', access, staffUser);
      const stored = await this.pgRepo.latestDealFile(leadId, 'contract');
      if (stored?.storage_path) {
        return {
          filename: stored.file_name || `hop-dong-${leadId}.docx`,
          buffer: this.pgRepo.readStoredDealFile(stored.storage_path),
        };
      }
      const out = await this.pgRepo.quoteContractDocx(leadId);
      await this.persistGeneratedDealFile(
        leadId,
        'contract',
        out.filename,
        CONTRACT_DOCX_MIME,
        out.buffer,
        staffUser,
        'replace-export',
      );
      return out;
    } catch (err) {
      this.funnelError(err);
    }
  }

  async ensureContractDealFile(leadId: number, staffUser?: StaffJwtPayload) {
    try {
      const access = await this.quoteSheetAccess(staffUser);
      await this.assertCanDownloadDealFile(leadId, 'contract', access, staffUser);
      const perm = await this.dealFilePermissions(leadId, 'contract', access, staffUser);
      if (!perm.can_upload) {
        throw new ForbiddenException({ error: perm.blocked_reason || 'Bạn không được tạo file hợp đồng.' });
      }
      const stored = await this.pgRepo.latestDealFile(leadId, 'contract');
      if (!stored?.storage_path) {
        const out = await this.pgRepo.quoteContractDocx(leadId);
        await this.persistGeneratedDealFile(
          leadId,
          'contract',
          out.filename,
          CONTRACT_DOCX_MIME,
          out.buffer,
          staffUser,
          'replace-export',
        );
      }
      return await this.listDealFiles(leadId, staffUser);
    } catch (err) {
      this.funnelError(err);
    }
  }

  async listDealFiles(leadId: number, staffUser?: StaffJwtPayload) {
    try {
      const access = await this.quoteSheetAccess(staffUser);
      const snap = await this.pgRepo.getPresalesSnapshot(leadId);
      let files = await this.pgRepo.listDealFiles(leadId);
      const hasQuoteFile = files.some((row) => row.kind === 'quote');
      if (!hasQuoteFile && this.quoteHasBeenSubmitted(snap)) {
        await this.attachQuoteExportOnSubmit(leadId, staffUser);
        files = await this.pgRepo.listDealFiles(leadId);
      }
      const hasContractFile = files.some((row) => row.kind === 'contract');
      if (!hasContractFile && Boolean(snap?.presales?.contract_created_at)) {
        await this.attachContractExport(leadId, staffUser);
        files = await this.pgRepo.listDealFiles(leadId);
      }
      const quotePerm = await this.dealFilePermissions(leadId, 'quote', access, staffUser, snap);
      const contractPerm = await this.dealFilePermissions(leadId, 'contract', access, staffUser, snap);
      const quoteVersions = quotePerm.can_download ? files.filter((row) => row.kind === 'quote') : [];
      const contractVersions = contractPerm.can_download ? files.filter((row) => row.kind === 'contract') : [];
      return {
        quote: {
          current: quoteVersions[0] ?? null,
          versions: quoteVersions,
          can_upload: quotePerm.can_upload,
          can_download: quotePerm.can_download,
          blocked_reason: quotePerm.blocked_reason,
        },
        contract: {
          current: contractVersions[0] ?? null,
          versions: contractVersions,
          can_upload: contractPerm.can_upload,
          can_download: contractPerm.can_download,
          blocked_reason: contractPerm.blocked_reason,
        },
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async downloadDealFile(leadId: number, fileId: number, staffUser?: StaffJwtPayload) {
    try {
      const access = await this.quoteSheetAccess(staffUser);
      const row = await this.pgRepo.getDealFile(leadId, fileId);
      if (!row) throw new BadRequestException({ error: 'Không tìm thấy file.' });
      await this.assertCanDownloadDealFile(leadId, row.kind, access, staffUser);
      return {
        filename: row.file_name,
        mime: row.mime_type,
        buffer: this.pgRepo.readStoredDealFile(row.storage_path),
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async uploadDealFile(
    leadId: number,
    kind: DealFileKind,
    file: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer } | undefined,
    staffId: number | null,
    staffUser?: StaffJwtPayload,
  ) {
    if (!file?.buffer || !file.buffer.length) {
      throw new BadRequestException({ error: 'Chưa chọn file để tải lên.' });
    }
    if ((file.size ?? file.buffer.length) > DEAL_FILE_MAX_BYTES) {
      throw new BadRequestException({ error: 'File vượt quá 20MB.' });
    }
    const detected = detectDealUpload(kind, String(file.originalname ?? ''), String(file.mimetype ?? ''));
    if (!detected) {
      throw new BadRequestException({
        error: kind === 'quote' ? 'Chỉ nhận file báo giá .xlsx hoặc .pdf.' : 'Chỉ nhận file hợp đồng .docx hoặc .pdf.',
      });
    }
    try {
      const access = await this.quoteSheetAccess(staffUser);
      const snap = await this.pgRepo.getPresalesSnapshot(leadId);
      const perm = await this.dealFilePermissions(leadId, kind, access, staffUser, snap);
      if (!perm.can_upload) {
        throw new ForbiddenException({ error: perm.blocked_reason || 'Bạn không được tải lên file này.' });
      }
      const label = await this.pgRepo.staffLabelById(staffId);
      const email = String(staffUser?.email ?? label.email).trim();
      const fileName = safeDealFileName(file.originalname || `${kind === 'quote' ? 'bao-gia' : 'hop-dong'}-${leadId}.${detected.ext}`);
      const saved = await this.pgRepo.saveDealFile({
        leadId,
        kind,
        fileName,
        mimeType: detected.mime,
        buffer: file.buffer,
        source: 'upload',
        staffId,
        staffName: label.name || email,
        staffEmail: email,
      });
      let contractReopened = false;
      if (kind === 'contract') {
        contractReopened = await this.pgRepo.reopenApprovedContractForFileEdit(leadId, staffId);
      }
      return {
        file: saved,
        contract_reopened: contractReopened,
        files: await this.listDealFiles(leadId, staffUser),
        funnel: await this.getFunnel(leadId),
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  private async persistGeneratedDealFile(
    leadId: number,
    kind: DealFileKind,
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    staffUser?: StaffJwtPayload,
    mode: 'insert' | 'replace-export' = 'insert',
  ): Promise<void> {
    try {
      const staffId = staffUser ? await this.staffAuth.resolveCrmStaffUserId(staffUser) : null;
      const label = await this.pgRepo.staffLabelById(staffId);
      const email = String(staffUser?.email ?? label.email).trim();
      const payload = {
        leadId,
        kind,
        fileName,
        mimeType,
        buffer,
        staffId,
        staffName: label.name || email,
        staffEmail: email,
      };
      if (mode === 'replace-export') {
        await this.pgRepo.saveOrReplaceExportDealFile(payload);
      } else {
        await this.pgRepo.saveDealFile({ ...payload, source: 'export' });
      }
    } catch (err) {
      console.warn(`[deal-files] persist ${kind} export failed: ${(err as Error)?.message ?? err}`);
    }
  }

  private async attachContractExport(leadId: number, staffUser?: StaffJwtPayload): Promise<void> {
    try {
      const stored = await this.pgRepo.latestDealFile(leadId, 'contract');
      if (stored?.storage_path) return;
      const out = await this.pgRepo.quoteContractDocx(leadId);
      await this.persistGeneratedDealFile(
        leadId,
        'contract',
        out.filename,
        CONTRACT_DOCX_MIME,
        out.buffer,
        staffUser,
        'replace-export',
      );
    } catch (err) {
      console.warn(`[deal-files] attach contract export failed: ${(err as Error)?.message ?? err}`);
    }
  }

  private async attachQuoteExportOnSubmit(leadId: number, staffUser?: StaffJwtPayload): Promise<void> {
    try {
      const access = await this.quoteSheetAccess(staffUser);
      const view = await this.pgRepo.getQuoteSheet(leadId, null, access);
      const estimated = await this.estimateQuoteExportKpis(leadId, view);
      const out = await this.pgRepo.quoteSheetXlsx(leadId, estimated);
      await this.persistGeneratedDealFile(
        leadId,
        'quote',
        out.filename,
        QUOTE_XLSX_MIME,
        out.buffer,
        staffUser,
        'replace-export',
      );
    } catch (err) {
      console.warn(`[deal-files] attach quote export failed: ${(err as Error)?.message ?? err}`);
    }
  }

  private quoteHasBeenSubmitted(
    snap: Awaited<ReturnType<LeadsFunnelPgRepository['getPresalesSnapshot']>>,
  ): boolean {
    if (!snap) return false;
    if (snap.presales.quote_sent_back_at || snap.presales.quote_approved_at) return true;
    const phase = String(snap.quote_case?.phase ?? '');
    return phase === 'ceo_review' || phase === 'sale_review' || phase === 'hop_dong' || phase === 'trien_khai';
  }

  private quoteAwaitingCeo(snap: Awaited<ReturnType<LeadsFunnelPgRepository['getPresalesSnapshot']>>): boolean {
    if (!snap) return false;
    if (snap.presales.quote_approved_at) return false;
    return Boolean(snap.presales.quote_sent_back_at);
  }

  private isQuoteAssignee(snap: Awaited<ReturnType<LeadsFunnelPgRepository['getPresalesSnapshot']>>, staffId: number | null): boolean {
    const actorId = Number(staffId ?? 0);
    if (!snap || !(actorId > 0)) return false;
    const owners = [
      snap.presales.quote_assignee_staff_id,
      snap.presales.solution_owner_staff_id,
      snap.presales.last_solution_owner_staff_id,
    ]
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    return owners.includes(actorId);
  }

  private async dealFilePermissions(
    leadId: number,
    kind: DealFileKind,
    access: { isSales: boolean; asPrivileged: boolean },
    staffUser?: StaffJwtPayload,
    snap?: Awaited<ReturnType<LeadsFunnelPgRepository['getPresalesSnapshot']>>,
  ): Promise<{ can_upload: boolean; can_download: boolean; blocked_reason?: string }> {
    const current = snap ?? (await this.pgRepo.getPresalesSnapshot(leadId));
    const asSuper = await this.actorIsSuperAdmin(staffUser);
    const asCeo = asSuper || access.asPrivileged || isCeoPosition(await this.actorPositionCode(staffUser));
    const staffId = staffUser ? await this.staffAuth.resolveCrmStaffUserId(staffUser) : null;
    const asAssignee = this.isQuoteAssignee(current, staffId);
    const quoteApproved = Boolean(current?.presales.quote_approved_at);
    const contractReady = quoteApproved || Boolean(current?.presales.contract_created_at);
    if (kind === 'quote') {
      if (access.isSales && !asSuper && !asCeo) {
        return quoteApproved
          ? { can_upload: false, can_download: true }
          : { can_upload: false, can_download: false, blocked_reason: 'Sales tải file báo giá sau khi CEO duyệt.' };
      }
      const awaiting = this.quoteAwaitingCeo(current);
      const canUpload = asCeo || (asAssignee && !awaiting && !quoteApproved);
      let blocked: string | undefined;
      if (!canUpload && asAssignee && (awaiting || quoteApproved)) {
        blocked = 'Báo giá đã nộp. Chỉ CEO hoặc Super-Admin được tải lên bản sửa.';
      }
      return { can_upload: canUpload, can_download: true, blocked_reason: blocked };
    }
    if (!contractReady) {
      return {
        can_upload: false,
        can_download: false,
        blocked_reason: 'Hợp đồng mở sau khi CEO duyệt báo giá.',
      };
    }
    if (access.isSales && !asSuper && !asCeo) {
      return { can_upload: false, can_download: true };
    }
    const implemented =
      String(current?.presales.implementation_status ?? '').trim() === 'trien_khai' ||
      String(current?.quote_case?.phase ?? '') === 'trien_khai' ||
      Boolean(String(current?.presales.contract_signed_at ?? '').trim());
    if (implemented) {
      return {
        can_upload: false,
        can_download: true,
        blocked_reason: 'Hợp đồng đã được GĐKD duyệt.',
      };
    }
    const canUpload = asCeo || asAssignee;
    return {
      can_upload: canUpload,
      can_download: true,
      blocked_reason: canUpload ? undefined : 'Chỉ AM phụ trách, CEO hoặc Super-Admin được tải lên file hợp đồng.',
    };
  }

  private async assertCanDownloadDealFile(
    leadId: number,
    kind: DealFileKind,
    access: { isSales: boolean; asPrivileged: boolean },
    staffUser?: StaffJwtPayload,
  ): Promise<void> {
    const perm = await this.dealFilePermissions(leadId, kind, access, staffUser);
    if (!perm.can_download) {
      throw new ForbiddenException({ error: perm.blocked_reason || 'Bạn không được tải file này.' });
    }
  }

  async saveQuoteSheet(
    leadId: number,
    staffId: number | null,
    body: { service_codes?: unknown; lines?: unknown; vat_percent?: unknown; promo_percent?: unknown },
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      const access = await this.quoteSheetAccess(staffUser);
      if (access.isSales && !(await this.actorIsSuperAdmin(staffUser))) {
        throw new ForbiddenException({ error: 'Sales không được sửa hoặc nộp báo giá.' });
      }
      const asPrivileged =
        (await this.actorIsSuperAdmin(staffUser)) || isCeoPosition(await this.actorPositionCode(staffUser));
      return await this.pgRepo.saveQuoteSheet(leadId, staffId, body, asPrivileged);
    } catch (err) {
      this.funnelError(err);
    }
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
    staffUser?: StaffJwtPayload,
  ) {
    try {
      const task = await this.pgRepo.getPresalesTaskById(taskId);
      if (!task) {
        throw new NotFoundException({ error: 'Không tìm thấy task pre-sales' });
      }
      await this.assertConsultMutationAllowed(leadId, staffUser, task.stage);

      const mergedFormData = mergePresalesFormData(task.form_data, body.form_data);
      if (body.is_done === true) {
        assertPresalesConsultTaskDone({
          stage: task.stage,
          aiPromptKey: task.ai_prompt_key,
          aiOutput: task.ai_output,
          formFields: task.form_fields,
          formData: mergedFormData,
        });
        if (task.stage === 'consult') {
          const snap = await this.pgRepo.getPresalesSnapshot(leadId);
          if (snap) {
            assertPresalesL2DocsComplete(snap.presales.service_slug, snap.presales.l2_docs_json);
          }
        }
      }

      const patchBody: PatchPresalesTaskBody = { ...body };
      if (body.form_data !== undefined || body.is_done === true) {
        patchBody.form_data = mergedFormData;
      }

      await this.pgRepo.updatePresalesTask(taskId, patchBody, doneBy);
      if (body.is_done === true) {
        await this.maybeEnqueueM3Prep(leadId);
      }
      return { ok: true, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async patchPresalesL2Docs(leadId: number, body: PatchPresalesL2DocsBody, staffUser?: StaffJwtPayload) {
    try {
      await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
      await this.pgRepo.updatePresalesL2Docs(leadId, body.docs ?? {});
      return { ok: true, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getPresalesConsultSlaSummary(amId?: number | null) {
    const summary = await this.pgRepo.getPresalesConsultSlaSummary(amId);
    return { ok: true, summary };
  }

  async getPresalesFunnelMetrics(query: {
    periodStart?: string | null;
    periodEnd?: string | null;
    amId?: number | null;
  }) {
    const payload = await this.pgRepo.getPresalesFunnelMetrics(query);
    return { ok: true as const, ...payload };
  }

  async createPresalesConsultSlaReminder(
    leadId: number,
    body: PresalesConsultSlaReminderBody,
    actor: string,
    userId: number | null,
  ) {
    try {
      const snap = await this.pgRepo.getPresalesSnapshot(leadId);
      if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
      if (snap.presales.stage !== 'consult') {
        throw new BadRequestException({ error: 'SLA Consult→Báo giá chỉ áp dụng khi stage = consult' });
      }
      const sla = snap.consult_proposal_sla;
      const note =
        String(body.message ?? '').trim() ||
        `Nhắc chuyển → Báo giá trong SLA 48h — ${sla.message}`;
      const { activity } = await this.legacyLeads.createActivity(
        leadId,
        {
          activity_type: 'note',
          content: `SLA pre-sales: ${note}`,
          result: 'Reminder nội bộ — không auto-send khách (BR-AI-01).',
          next_action: 'Chuyển → Báo giá trên funnel stepper',
        },
        actor,
        userId,
      );
      return {
        ok: true,
        lead_id: leadId,
        activity_id: activity.id,
        sla,
        funnel: await this.getFunnel(leadId),
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getMarketingPlan(leadId: number) {
    const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
    if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
    const plan = await this.pgRepo.getOrCreatePreliminaryPlan(leadId, ps.id, ps.service_slug);
    const validation = validatePreliminaryPlan(plan);
    const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
    return { ok: true, plan, validation, ai_draft };
  }

  private mergeManualMarketingPlanPatch(
    plan: Record<string, unknown>,
    body: PatchMarketingPlanBody,
  ): PatchMarketingPlanBody {
    const prof = clearPresalesAiDraftMeta({
      ...parseTargetMarketProfJson(plan.target_market_prof_json),
      ...(body.target_market_prof ?? {}),
    });
    const brief = readClientBrief(prof);
    return {
      ...body,
      target_market_prof: writeClientBrief(prof, { ...brief, saved_after_ai: true }),
    };
  }

  async patchMarketingPlan(leadId: number, body: PatchMarketingPlanBody, staffUser?: StaffJwtPayload) {
    await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
    const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
    if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
    const existing = await this.pgRepo.getOrCreatePreliminaryPlan(leadId, ps.id, ps.service_slug);
    const beforeFiles = this.marketingPlanFileNames(existing);
    const patchBody = this.mergeManualMarketingPlanPatch(existing, body);
    const plan = await this.pgRepo.patchMarketingPlan(leadId, patchBody);
    const afterFiles = this.marketingPlanFileNames(plan);
    const added = afterFiles.filter((name) => !beforeFiles.includes(name));
    if (added.length) {
      const staffId = staffUser ? await this.staffAuth.resolveCrmStaffUserId(staffUser) : null;
      for (const fileName of added) {
        await this.logSolutionHandoffActivity(
          leadId,
          SOLUTION_HANDOFF_ACTIVITY_TYPES.uploaded,
          staffUser?.email || (staffId ? `staff:${staffId}` : 'system'),
          staffId ?? null,
          staffUser,
          undefined,
          { fileName },
        );
      }
    }
    const validation = validatePreliminaryPlan(plan);
    const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
    return { ok: true, plan, validation, ai_draft, funnel: await this.getFunnel(leadId) };
  }

  private async assertPresalesMktAiGenerateCap(staffUser?: StaffJwtPayload): Promise<void> {
    if (!staffUser) return;
    if (await this.staffAuth.isSuperAdminUser(staffUser)) return;
    const me = await this.staffAuth.me(staffUser);
    if (isAccountManagerPosition(me.position_code)) return;
    const consultEdit = this.staffAuth.hasCap(me.caps, 'crm_presales_solution', 'edit');
    const boardEdit = this.staffAuth.hasCap(me.caps, 'crm_board', 'edit');
    if (!consultEdit && !boardEdit) {
      throw new ForbiddenException({
        error: 'missing_cap',
        message: 'Bạn chưa được cấp quyền thực hiện thao tác này.',
        section: 'crm_board',
        action: 'edit',
      });
    }
    if (!this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'generate')) {
      throw new ForbiddenException({
        error: 'missing_cap',
        message: 'Bạn chưa được cấp quyền thực hiện thao tác này.',
        section: 'crm_mkt_ai',
        action: 'generate',
      });
    }
  }

  private async assertPresalesMktAiEnabled(serviceSlug: string, staffUser?: StaffJwtPayload): Promise<void> {
    // AM / Super-Admin Solution AI is not gated by Marketing AI Planner playbook rollout.
    if (staffUser && (await this.staffAuth.isSuperAdminUser(staffUser))) return;
    if (staffUser) {
      const me = await this.staffAuth.me(staffUser);
      if (isAccountManagerPosition(me.position_code)) return;
    }
    await this.mktAiAllow.ensure(serviceSlug ?? '');
  }

  async suggestClientBriefFacts(leadId: number, staffUser?: StaffJwtPayload) {
    try {
      rejectMktAiAutoCustomerEmail(this.config.mktAiAutoCustomerEmailEnabled, {});
      await this.assertPresalesMktAiGenerateCap(staffUser);
      await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
      const loaded = await this.loadClientBrief(leadId);
      await this.assertPresalesMktAiEnabled(loaded.snap.presales.service_slug, staffUser);
      const facts = {
        company: loaded.company_name,
        niche: loaded.niche,
        need: loaded.need,
      };
      const missing = [
        !briefFieldFilled(facts.company) ? 'Tên công ty trên hồ sơ lead' : '',
        !briefFieldFilled(facts.niche) ? 'Ngành KH' : '',
        !briefFieldFilled(facts.need) ? 'Nhu cầu cụ thể' : '',
      ].filter(Boolean);
      if (missing.length) {
        throw new BadRequestException({
          error: 'client_facts_incomplete',
          message: missing.join('; '),
          details: missing,
        });
      }
      const selection = selectClientPlanModel({
        hasPublicSource: false,
        mktAiModel: this.config.mktAiModel,
        openAiModel: this.config.openAiModel,
        llmModel: this.aiConfig.llmModel,
      });
      const suggestInput = {
        ...facts,
        serviceLabel: SERVICE_LABELS[loaded.snap.presales.service_slug] ?? loaded.snap.presales.service_slug,
        metrics: loaded.brief.metrics,
        budget: taskBudget(loaded.tasks),
      };
      const built = buildConsultFactsSuggestCall(suggestInput);
      const completion = await this.llm.completeJson({
        systemPrompt: built.systemPrompt,
        userContent: built.userContent,
        model: selection.model,
        imageUrls: [],
        stubJson: built.stubJson,
      });
      const suggestion = normalizeConsultFactsSuggest(completion.parsed, suggestInput);
      return { ok: true, ...suggestion, ai: { stub_mode: completion.stubMode, model: selection.model } };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async generatePresalesMarketingPlanAiDraft(leadId: number, staffUser?: StaffJwtPayload) {
    try {
      rejectMktAiAutoCustomerEmail(this.config.mktAiAutoCustomerEmailEnabled, {});
      await this.assertPresalesMktAiGenerateCap(staffUser);
      const loaded = await this.loadClientBrief(leadId);
      const serviceSlug = loaded.snap.presales.service_slug;
      await this.assertPresalesMktAiEnabled(serviceSlug, staffUser);
      const missing = clientBriefMissing(loaded.brief, {
        company_name: loaded.company_name,
        niche: loaded.niche,
        need: loaded.need,
      });
      if (missing.length) {
        throw new BadRequestException({
          error: 'client_brief_incomplete',
          message: missing.join('; '),
          details: missing,
        });
      }

      const urls = [loaded.brief.website, loaded.brief.fanpage].map((url) => String(url ?? '').trim()).filter(Boolean);
      const hasPublicSource = urls.length > 0;
      const sources = hasPublicSource
        ? await fetchClientPlanSources(urls, fetch)
        : { text: '', image_urls: [] as string[], fetched_urls: [] as string[], errors: [] as string[] };
      const content = planContentFromRow(loaded.plan);
      const context = await loadSolutionAiContext(this.config.databaseUrl, leadId, {
        id: Number((loaded.plan as { id?: number }).id ?? 0),
        strategy_framework: content.strategy_framework,
        strategy_framework_json: (loaded.plan as { strategy_framework_json?: unknown }).strategy_framework_json,
      });
      const briefText = [
        `Công ty: ${loaded.company_name || context.companyName || ''}`,
        `Ngành: ${loaded.niche || ''}`,
        `Nhu cầu: ${loaded.need || ''}`,
        `USP / brief: ${[
          loaded.brief.audience,
          loaded.brief.usp,
          loaded.brief.goal,
          loaded.brief.channels,
          loaded.brief.retain,
          loaded.brief.competitors,
          loaded.brief.metrics,
        ]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .join('\n')}`,
      ].join('\n');
      const agent = readSolutionAgentConfig();
      const hasKey = Boolean(this.aiConfig.llmApiKey);
      if (agent.configured) {
        return this.dispatchSolutionAiAgentJob({
          leadId,
          staffUser,
          loaded,
          content,
          context,
          briefText,
          sourceText: sources.text,
          sourceErrors: sources.errors,
          agent,
        });
      }
      if (!hasKey) {
        throw new BadRequestException({
          error: 'ai_not_configured',
          message: SOLUTION_AI_NOT_CONFIGURED,
        });
      }

      const selection = selectClientPlanModel({
        hasPublicSource,
        mktAiModel: this.config.mktAiModel,
        openAiModel: this.config.openAiModel,
        llmModel: this.aiConfig.llmModel,
      });
      const built = buildSolutionAiDraftCall({
        companyName: loaded.company_name || context.companyName,
        briefText,
        discoveryText: context.discoveryText,
        serviceLines: context.serviceLinesText,
        budgetLabel: context.budgetLabel || taskBudget(loaded.tasks) || '',
        timelineLabel: context.timelineLabel,
        callNotes: context.callNotes,
        attachmentText: context.attachmentText,
        sourceText: sources.text,
      });
      const completion = await this.llm.completeJson({
        systemPrompt: built.systemPrompt,
        userContent: built.userContent,
        model: selection.model,
        stubJson: () => ({}),
        timeoutMs: Math.max(60_000, Number(this.aiConfig.llmTimeoutMs) || 0),
      });
      if (completion.stubMode) {
        throw new BadRequestException({
          error: 'ai_not_configured',
          message: SOLUTION_AI_NOT_CONFIGURED,
        });
      }
      const parsed = completion.parsed && typeof completion.parsed === 'object'
        ? (completion.parsed as Record<string, unknown>)
        : {};
      const packed = packSolutionAi({
        status: 'ready',
        source: 'llm',
        requested_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        title: String(parsed.title ?? '').trim() || `Solution sơ bộ — ${loaded.company_name || context.companyName || 'lead'}`,
        sections: normalizeSolutionAiSections(parsed.sections ?? parsed),
      });
      return this.persistSolutionAiDraft({
        leadId,
        staffUser,
        loaded,
        content,
        packed,
        modelName: completion.modelName || selection.model,
        stubMode: false,
        source: 'llm',
        status: 'ready',
        sourceErrors: sources.errors,
      });
    } catch (err) {
      this.funnelError(err);
    }
  }

  async receiveSolutionAiCallback(leadId: number, body: Record<string, unknown>, signature: string) {
    try {
      const agent = readSolutionAgentConfig();
      if (!agent.configured || !verifySolutionAiSignature(agent.secret, body, signature)) {
        throw new UnauthorizedException({ error: 'invalid_signature', message: 'Chữ ký không hợp lệ' });
      }
      const bodyLead = Number(body.lead_id ?? body.leadId ?? 0);
      if (bodyLead && bodyLead !== Number(leadId)) {
        throw new BadRequestException({ error: 'lead_mismatch', message: 'lead_id không khớp' });
      }
      const loaded = await this.loadClientBrief(leadId);
      const content = planContentFromRow(loaded.plan);
      const current = parseSolutionAiFromStrategy(content.strategy_framework);
      const jobId = String(body.job_id ?? body.jobId ?? '').trim();
      if (current?.job_id && jobId && current.job_id !== jobId) {
        throw new BadRequestException({ error: 'job_mismatch', message: 'job_id không khớp' });
      }
      const sectionRaw = (body.sections ?? body.solution ?? body) as unknown;
      const packed = packSolutionAi({
        status: 'ready',
        source: 'agent',
        job_id: jobId || current?.job_id,
        requested_at: current?.requested_at,
        completed_at: new Date().toISOString(),
        title: String(body.title ?? current?.title ?? '').trim() || current?.title,
        sections: normalizeSolutionAiSections(sectionRaw),
        job: current?.job,
      });
      const out = await this.persistSolutionAiDraft({
        leadId,
        loaded,
        content,
        packed,
        modelName: 'agent',
        stubMode: false,
        source: 'agent',
        status: 'ready',
        sourceErrors: [],
      });
      await this.notifyResponsible(loaded.snap.presales.assigned_am, {
        kind: 'presales_solution',
        title: 'AI đã viết xong Solution',
        body: `Lead #${leadId} — bản nháp AI đã sẵn sàng. Vui lòng kiểm tra và chỉnh sửa trước khi nộp.`,
        link_href: `/crm/leads/${leadId}`,
        meta_json: { lead_id: leadId, action: 'open_lead', source: 'solution_ai' },
      });
      return out;
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getSolutionAiJob(leadId: number, signature: string) {
    try {
      const agent = readSolutionAgentConfig();
      const signedLead = { lead_id: leadId };
      if (!agent.configured || !verifySolutionAiSignature(agent.secret, signedLead, signature)) {
        throw new UnauthorizedException({ error: 'invalid_signature', message: 'Chữ ký không hợp lệ' });
      }
      const loaded = await this.loadClientBrief(leadId);
      const content = planContentFromRow(loaded.plan);
      const packed = parseSolutionAiFromStrategy(content.strategy_framework);
      if (!packed) {
        throw new NotFoundException({ error: 'solution_ai_job_not_found', message: 'Chưa có job AI Solution' });
      }
      return { ok: true, lead_id: leadId, job: packed.job ?? packed };
    } catch (err) {
      this.funnelError(err);
    }
  }

  private async dispatchSolutionAiAgentJob(input: {
    leadId: number;
    staffUser?: StaffJwtPayload;
    loaded: Awaited<ReturnType<LeadsFunnelService['loadClientBrief']>>;
    content: ReturnType<typeof planContentFromRow>;
    context: Awaited<ReturnType<typeof loadSolutionAiContext>>;
    briefText: string;
    sourceText: string;
    sourceErrors: string[];
    agent: ReturnType<typeof readSolutionAgentConfig>;
  }) {
    const jobId = randomUUID();
    const planId = Number((input.loaded.plan as { id?: number }).id ?? 0);
    const job = {
      lead_id: input.leadId,
      plan_id: planId,
      job_id: jobId,
      callback_url: `${input.agent.publicUrl}/api/v1/leads/${input.leadId}/presales/solution-ai/callback`,
      inputs: {
        company_name: input.loaded.company_name || input.context.companyName,
        brief: input.briefText,
        discovery: input.context.discovery,
        discovery_text: input.context.discoveryText,
        services: input.context.serviceLines,
        service_lines: input.context.serviceLinesText,
        budget: input.context.budgetLabel,
        timeline: input.context.timelineLabel,
        call_notes: input.context.callNotes,
        attachments: input.context.attachments.map((row) => ({
          name: row.name,
          text: row.text,
          error: row.error,
        })),
        source_text: input.sourceText,
      },
    };
    const posted = await postSolutionAiWebhook(
      input.agent.webhookUrl,
      job,
      signSolutionAiPayload(input.agent.secret, job),
    );
    if (!posted.ok) {
      throw new ServiceUnavailableException({
        error: 'solution_agent_unavailable',
        message: 'Không gửi được yêu cầu tới agent AI',
      });
    }
    const packed = packSolutionAi({
      status: 'pending',
      source: 'agent',
      job_id: jobId,
      requested_at: new Date().toISOString(),
      title: `Solution sơ bộ — ${input.loaded.company_name || input.context.companyName || 'lead'}`,
      sections: emptySolutionAiSections(),
      job,
    });
    return this.persistSolutionAiDraft({
      leadId: input.leadId,
      staffUser: input.staffUser,
      loaded: input.loaded,
      content: input.content,
      packed,
      modelName: 'agent',
      stubMode: false,
      source: 'agent',
      status: 'pending',
      sourceErrors: input.sourceErrors,
    });
  }

  private async persistSolutionAiDraft(input: {
    leadId: number;
    staffUser?: StaffJwtPayload;
    loaded: Awaited<ReturnType<LeadsFunnelService['loadClientBrief']>>;
    content: ReturnType<typeof planContentFromRow>;
    packed: ReturnType<typeof packSolutionAi>;
    modelName: string;
    stubMode: boolean;
    source: 'llm' | 'agent';
    status: 'pending' | 'ready' | 'error';
    sourceErrors: string[];
  }) {
    const existingProf = parseTargetMarketProfJson(input.loaded.plan.target_market_prof_json);
    const currentBrief = readClientBrief(existingProf);
    let prof = writeClientBrief(existingProf, { ...currentBrief, saved_after_ai: false });
    prof = stampPresalesAiDraftMeta(prof, input.staffUser?.email ?? 'unknown', input.modelName, {
      stub_mode: input.stubMode,
      source: input.source,
      status: input.status,
    });
    const strategy = mergeSolutionAiIntoStrategy(input.content.strategy_framework, input.packed);
    const planName =
      input.content.name ||
      input.packed.title ||
      `Solution sơ bộ — ${input.loaded.company_name || 'lead'}`;
    const plan = await this.pgRepo.patchMarketingPlan(input.leadId, {
      name: planName,
      strategy_framework: strategy,
      target_market_prof: prof,
    });
    const validation = validatePreliminaryPlan(plan);
    const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
    const staffId = input.staffUser ? await this.staffAuth.resolveCrmStaffUserId(input.staffUser) : null;
    await this.logSolutionHandoffActivity(
      input.leadId,
      SOLUTION_HANDOFF_ACTIVITY_TYPES.ai_draft,
      input.staffUser?.email || (staffId ? `staff:${staffId}` : 'system'),
      staffId ?? null,
      input.staffUser,
    );
    return {
      ok: true,
      plan,
      validation,
      funnel: await this.getFunnel(input.leadId),
      ai_draft,
      requires_sp_review: true,
      badge_vi: input.status === 'pending' ? SOLUTION_AI_PENDING_LABEL : PRESALES_AI_DRAFT_BADGE_VI,
      ai: {
        stub_mode: input.stubMode,
        model: input.modelName,
        source: input.source,
        status: input.status,
      },
      source_errors: input.sourceErrors,
    };
  }

  async exportClientPlan(
    leadId: number,
    opts?: { sofficePath?: string | null; maskForeignContactForStaffId?: number | null },
  ) {
    try {
      const loaded = await this.loadClientBrief(leadId);
      const content = planContentFromRow(loaded.plan);
      const gate = validatePreliminaryPlan({
        name: content.name,
        north_star: content.north_star,
        objectives: content.objectives,
        strategy_framework_json: content.strategy_framework,
      });
      if (!gate.ok) {
        throw new BadRequestException({
          error: 'preliminary_plan_incomplete',
          message: gate.messages.join(' '),
          details: gate.messages,
        });
      }
      const prof = parseTargetMarketProfJson(loaded.plan.target_market_prof_json);
      const contact = await this.pgRepo.getLeadPlanContact(leadId);
      const maskFor = opts?.maskForeignContactForStaffId;
      if (maskFor != null) {
        const ownerId = (await this.pgRepo.fetchLeadRow(leadId))?.owner_id;
        if (ownerId == null || Number(ownerId) !== Number(maskFor)) {
          contact.phone = maskPartialPii(contact.phone);
          contact.email = maskPartialPii(contact.email);
        }
      }
      const framework = content.strategy_framework;
      const clientName = contact.company_name || loaded.company_name;
      const pptx = await renderClientPlanFromTemplate({
        client: clientName,
        phone: contact.phone,
        email: contact.email,
        address: contact.address,
        website: loaded.brief.website,
        fanpage: loaded.brief.fanpage,
        niche: loaded.niche,
        need: loaded.need,
        service: SERVICE_LABELS[loaded.snap.presales.service_slug] ?? loaded.snap.presales.service_slug,
        usp: loaded.brief.usp,
        goal: loaded.brief.goal || content.north_star,
        channels: loaded.brief.channels,
        audience: loaded.brief.audience || framework.target_market,
        competitors: String(prof.client_plan_competitors ?? loaded.brief.competitors ?? ''),
        metrics: loaded.brief.metrics,
        retain: loaded.brief.retain,
        budget: taskBudget(loaded.tasks),
        northStar: content.north_star,
        message: framework.market_message,
        media: framework.media_reach,
        conversion: framework.conversion_strategy,
      });
      const filename = clientPlanExportFilename(clientName);
      const sofficePath = opts ? (opts.sofficePath ?? null) : await findSoffice();
      const pdf = await convertClientPlanPdf(pptx, filename, sofficePath);
      return {
        ok: true as const,
        filename,
        pptx,
        pdf: pdf.pdf,
        pdfFilename: pdf.filename,
        note: pdf.note,
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  private async loadPresalesContext(leadId: number) {
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const intakeBundle = await this.intake.listSessions(leadId);
    const leadRow = await this.pgRepo.fetchLeadRow(leadId);
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
    let merged = brief;
    if (this.config.leadMeetingPrepEnabled && (await this.lmpRepo.tableReady())) {
      const prepRow = await this.lmpRepo.getByLeadId(leadId);
      merged = mergeLmpIntoConsultBrief(brief, extractLmpConsultMergeFields(prepRow));
    }
    return { ok: true, brief: merged };
  }

  async prefillPresalesConsult(leadId: number, body: ConsultPrefillBody, staffUser?: StaffJwtPayload) {
    try {
      await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
      const overwrite = Boolean(body.overwrite);
      const out = await this.pgRepo.runPresalesConsultPrefill(leadId, overwrite);

      if (
        this.config.leadMeetingPrepEnabled &&
        (await this.lmpRepo.tableReady()) &&
        out.task_id
      ) {
        const prepRow = await this.lmpRepo.getByLeadId(leadId);
        const lmp = extractLmpConsultMergeFields(prepRow);
        if (lmp.recommended_dv_codes.length) {
          const task = await this.pgRepo.getPresalesTaskById(out.task_id);
          if (task) {
            const applied = applyLmpDvCodesToConsultPrefill(
              task.form_data ?? {},
              lmp.recommended_dv_codes,
              task.form_fields ?? [],
              overwrite,
            );
            if (applied.filled.length) {
              const patch = { form_data: applied.form_data };
              await this.pgRepo.updatePresalesTask(out.task_id, patch, null);
              out.fields = [...new Set([...(out.fields ?? []), ...applied.filled])];
              out.filled = (out.filled ?? 0) + applied.filled.length;
            }
          }
        }
      }

      return { ok: true, ...out, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getClientBrief(leadId: number) {
    const { snap, plan, brief, company_name, niche, need } = await this.loadClientBrief(leadId);
    return clientBriefPayload(brief, { company_name, niche, need }, snap.presales.stage, Number(plan.id));
  }

  async patchClientBrief(leadId: number, body: PatchClientBriefBody, staffUser?: StaffJwtPayload) {
    try {
      await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
      const loaded = await this.loadClientBrief(leadId);
      const current = readClientBrief(loaded.plan.target_market_prof_json);
      const patch: Partial<PatchClientBriefBody> = {};
      for (const key of [
        'audience',
        'usp',
        'goal',
        'channels',
        'retain',
        'competitors',
        'metrics',
        'website',
        'fanpage',
      ] as const) {
        if (body[key] !== undefined) patch[key] = String(body[key] ?? '');
      }
      const merged = prefillClientBriefFromTasks({ ...current, ...patch }, loaded.tasks);
      if (body.saved_after_ai === undefined) merged.saved_after_ai = current.saved_after_ai;
      else merged.saved_after_ai = body.saved_after_ai === true;
      if (body.human_edited_keys === undefined) merged.human_edited_keys = current.human_edited_keys;
      else merged.human_edited_keys = body.human_edited_keys.map((key) => String(key).trim()).filter(Boolean);
      const prof = writeClientBrief(parseTargetMarketProfJson(loaded.plan.target_market_prof_json), merged);
      const saved = await this.pgRepo.replacePreliminaryProf(leadId, prof);
      const brief = readClientBrief(saved.target_market_prof_json);
      return {
        ok: true,
        brief,
        missing: clientBriefMissing(brief, {
          company_name: loaded.company_name,
          niche: loaded.niche,
          need: loaded.need,
        }),
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  private async loadClientBrief(leadId: number) {
    const { snap } = await this.loadPresalesContext(leadId);
    const plan = await this.pgRepo.getOrCreatePreliminaryPlan(
      leadId,
      snap.presales.id,
      snap.presales.service_slug,
    );
    const tasks = [...(snap.tasks.lead ?? []), ...(snap.tasks.consult ?? [])];
    const company_name = await this.pgRepo.getLeadCompanyName(leadId);
    const facts = leadQualifyFacts(snap.tasks.lead ?? []);
    const niche = resolveLeadNiche(facts.niche, await this.pgRepo.getLeadIndustryName(leadId));
    const brief = prefillClientBriefFromTasks(readClientBrief(plan.target_market_prof_json), tasks);
    const need = facts.need || (await this.pgRepo.getLeadNeed(leadId));
    return { snap, plan, tasks, brief, company_name, niche, need };
  }

  private async clientLeaveFacts(
    leadId: number,
    snap: { tasks: { lead?: Array<{ form_data?: Record<string, unknown> | null }>; consult?: Array<{ form_data?: Record<string, unknown> | null }> } },
    plan: { target_market_prof_json?: unknown },
  ) {
    const tasks = [...(snap.tasks.lead ?? []), ...(snap.tasks.consult ?? [])];
    const facts = leadQualifyFacts(snap.tasks.lead ?? []);
    return {
      company_name: await this.pgRepo.getLeadCompanyName(leadId),
      niche: resolveLeadNiche(facts.niche, await this.pgRepo.getLeadIndustryName(leadId)),
      need: facts.need || (await this.pgRepo.getLeadNeed(leadId)),
      brief: prefillClientBriefFromTasks(readClientBrief(plan.target_market_prof_json), tasks),
    };
  }

  async getPresalesProposalGate(leadId: number) {
    const { snap } = await this.loadPresalesContext(leadId);
    const plan = await this.pgRepo.getOrCreatePreliminaryPlan(
      leadId,
      snap.presales.id,
      snap.presales.service_slug,
    );
    const gate = buildProposalAdvanceGate({
      consultProgress: snap.progress.consult ?? { total: 0, done: 0 },
      plan: plan as {
        name?: string | null;
        north_star?: string | null;
        objectives?: string | null;
        strategy_framework_json?: string | null;
      },
      clientLeave: await this.clientLeaveFacts(leadId, snap, plan),
    });
    return { ok: true, gate, presales_stage: snap.presales.stage };
  }

  async getPresalesProposalHandoff(leadId: number) {
    try {
      const snap = await this.pgRepo.getPresalesSnapshot(leadId);
      if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
      const customerId = await this.pgRepo.getLeadConvertedCustomerId(leadId);
      const consultTasks = snap.tasks.consult ?? [];
      const plan = await this.pgRepo.getOrCreatePreliminaryPlan(
        leadId,
        snap.presales.id,
        snap.presales.service_slug,
      );
      const planContent = planContentFromRow(plan as Record<string, unknown>);
      const gate = buildProposalAdvanceGate({
        consultProgress: snap.progress.consult ?? { total: 0, done: 0 },
        plan: plan as {
          name?: string | null;
          north_star?: string | null;
          objectives?: string | null;
          strategy_framework_json?: string | null;
        },
        clientLeave: await this.clientLeaveFacts(leadId, snap, plan),
      });
      const l1Checklist = buildL1GateChecklist({
        gate,
        plan: {
          name: planContent.name,
          north_star: planContent.north_star,
          objectives: planContent.objectives,
          strategy_framework: planContent.strategy_framework,
        },
      });
      const handoff = buildPresalesProposalHandoff({
        leadId,
        serviceSlug: snap.presales.service_slug,
        customerId,
        consultTask: consultTasks[0] ?? null,
        proposalGate: gate,
        l1Checklist,
      });
      return { ok: true, handoff };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async runPresalesTaskAiAssist(
    leadId: number,
    taskId: number,
    body: PresalesAiAssistBody,
    staffUser?: StaffJwtPayload,
  ) {
    try {
      const task = await this.pgRepo.getPresalesTaskById(taskId);
      if (!task) throw new NotFoundException({ error: 'Không tìm thấy task pre-sales' });
      await this.assertConsultMutationAllowed(leadId, staffUser, task.stage);

      const snap = await this.pgRepo.getPresalesSnapshot(leadId);
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
      await this.pgRepo.updatePresalesTaskAiOutput(taskId, llmOut.text);
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

  async upgradePresalesWorkflowTemplate(leadId: number, body: UpgradePresalesWorkflowBody) {
    try {
      const opts = {
        stages: body.stages,
        dryRun: Boolean(body.dry_run),
        prefillConsult: body.prefill_consult !== false,
      };
      const out = await this.pgRepo.upgradePresalesWorkflowTemplate(leadId, opts);
      return { ...out, funnel: opts.dryRun ? undefined : await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async batchUpgradePresalesWorkflow(body: BatchUpgradePresalesWorkflowBody) {
    try {
      const dryRun = Boolean(body.dry_run);
      if (!dryRun && !this.config.presalesBatchUpgradeEnabled) {
        throw new ServiceUnavailableException({
          error: 'PTT_PRESALES_BATCH_UPGRADE disabled — dry-run only until gate pass',
        });
      }
      const stages = resolveBatchUpgradeStages(body.stages);
      const upgradeOpts = {
        stages,
        dryRun: false,
        prefillConsult: body.prefill_consult !== false,
      };
      const cohort = await this.pgRepo.listPresalesWorkflowUpgradeCohort({
        leadIds: body.lead_ids,
        limit: body.limit,
      });

      const csvRows = [buildBatchUpgradeCsvHeader(), ...cohort.map(cohortCsvRow)];

      if (dryRun) {
        return {
          ok: true,
          dry_run: true,
          cohort_size: cohort.length,
          processed: cohort.length,
          upgraded: 0,
          skipped: 0,
          results: cohort.map((row) => ({
            lead_id: row.lead_id,
            ok: true,
            service_slug: row.service_slug,
          })),
          csv_rows: csvRows,
        };
      }

      const results: BatchUpgradePresalesWorkflowResult['results'] = [];
      let upgraded = 0;
      let skipped = 0;
      for (const row of cohort) {
        try {
          const out = await this.pgRepo.upgradePresalesWorkflowTemplate(row.lead_id, upgradeOpts);
          upgraded += 1;
          results.push({
            lead_id: row.lead_id,
            ok: true,
            service_slug: out.service_slug,
            stages: out.stages,
          });
        } catch (err) {
          skipped += 1;
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ lead_id: row.lead_id, ok: false, error: msg });
        }
      }

      return {
        ok: skipped === 0,
        dry_run: false,
        cohort_size: cohort.length,
        processed: cohort.length,
        upgraded,
        skipped,
        results,
        csv_rows: csvRows,
      };
    } catch (err) {
      this.funnelError(err);
    }
  }
}

function taskBudget(tasks: Array<{ form_data?: Record<string, unknown> | null }>): string {
  for (const task of tasks) {
    const raw = task.form_data?.budget ?? task.form_data?.budget_vnd;
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return '';
}
