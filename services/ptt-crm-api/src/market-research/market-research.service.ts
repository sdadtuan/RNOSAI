import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientScopeContext, StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { JobQueueRepository } from '../webhooks/job-queue.repository';
import {
  INSIGHT_STATUSES,
  MAX_TAVILY_CREDITS_PER_RESEARCH,
  PROJECT_STATUSES,
  type InsightStatus,
  type ProjectStatus,
} from './market-research.constants';
import { MarketResearchRepository } from './market-research.repository';
import { evidenceChecksum } from './evidence-checksum.util';
import { assertEvidenceMutable, piiHint } from './evidence-immutable.util';
import { assertNotSelfApprove, canApproveTarget, evaluateInsightGate } from './insight-gate.util';
import type {
  ApproveInsightInput,
  CreateEvidenceInput,
  CreateInsightInput,
  CreateProjectInput,
  CreateQuestionInput,
  CreateSourceInput,
  ListProjectsFilters,
  PatchEvidenceInput,
  PatchInsightInput,
  PatchProjectInput,
  PatchQuestionInput,
  PatchSourceInput,
  ResearchAiRunRow,
  ResearchEvidenceRow,
  ResearchInsightRow,
  ResearchProjectDetail,
  ResearchProjectRow,
  ResearchQuestionRow,
  ResearchSourceRow,
  RunDeskInput,
  RunDeskResult,
} from './market-research.types';
import { validateCreateEvidence, validateCreateProject } from './market-research.validation';
import { canTransitionProject, listValidTransitions } from './project-state.util';

@Injectable()
export class MarketResearchService {
  constructor(
    private readonly repo: MarketResearchRepository,
    private readonly clientScope: StaffClientScopeService,
    private readonly jobQueue: JobQueueRepository,
  ) {}

  private assertClientInScope(scope: ClientScopeContext, clientId: string): void {
    if (!scope.restricted) return;
    const allowed = this.clientScope.allowedClientIdsForList(scope) ?? [];
    if (!allowed.includes(clientId.trim())) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  private async loadScopedProject(
    id: number,
    scope: ClientScopeContext,
  ): Promise<ResearchProjectRow> {
    const clientId = await this.repo.getProjectClientId(id);
    if (clientId == null) throw new NotFoundException({ error: 'not_found' });
    this.assertClientInScope(scope, clientId);
    const project = await this.repo.getProject(id);
    if (!project) throw new NotFoundException({ error: 'not_found' });
    return project;
  }

  async listProjects(
    scope: ClientScopeContext,
    filters: ListProjectsFilters,
  ): Promise<{ projects: ResearchProjectRow[] }> {
    if (filters.client_id?.trim()) {
      this.clientScope.assertListClientFilter(scope, filters.client_id);
    }
    const allowed = this.clientScope.allowedClientIdsForList(scope);
    const projects = await this.repo.listProjects(filters, allowed);
    return { projects };
  }

  async createProject(
    scope: ClientScopeContext,
    input: CreateProjectInput,
    actor: string,
  ): Promise<{ ok: true; project: ResearchProjectDetail }> {
    const messages = validateCreateProject(input);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    this.assertClientInScope(scope, input.client_id);
    const project = await this.repo.createProject(input, actor);
    return { ok: true, project: await this.toDetail(project) };
  }

  async getProject(id: number, scope: ClientScopeContext): Promise<ResearchProjectDetail> {
    const project = await this.loadScopedProject(id, scope);
    return this.toDetail(project);
  }

  async patchProject(
    id: number,
    scope: ClientScopeContext,
    input: PatchProjectInput,
    actor: string,
  ): Promise<ResearchProjectDetail> {
    const project = await this.loadScopedProject(id, scope);
    if (input.status != null && input.status !== project.status) {
      if (!PROJECT_STATUSES.includes(input.status as ProjectStatus)) {
        throw new ConflictException({
          error: 'invalid_transition',
          reason: `${project.status}->${input.status}`,
        });
      }
      const result = canTransitionProject(project.status, input.status as ProjectStatus, {
        rqCount: project.rq_count,
        verifiedInsightCount: project.verified_insight_count,
      });
      if (!result.ok) {
        throw new ConflictException({ error: result.error, reason: result.reason });
      }
    }
    const updated = await this.repo.patchProject(id, input, actor);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return this.toDetail(updated);
  }

  async addQuestion(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateQuestionInput,
  ): Promise<ResearchQuestionRow> {
    await this.loadScopedProject(projectId, scope);
    if (!String(input.question_vi ?? '').trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_vi is required'],
      });
    }
    return this.repo.addQuestion(projectId, input);
  }

  async patchQuestion(
    questionId: number,
    scope: ClientScopeContext,
    input: PatchQuestionInput,
  ): Promise<ResearchQuestionRow> {
    const existing = await this.repo.getQuestion(questionId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    if (input.question_vi != null && !input.question_vi.trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_vi is required'],
      });
    }
    const updated = await this.repo.patchQuestion(questionId, input);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async deleteQuestion(questionId: number, scope: ClientScopeContext): Promise<{ ok: true }> {
    const existing = await this.repo.getQuestion(questionId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const evidenceCount = await this.repo.countEvidenceForQuestion(questionId);
    if (evidenceCount > 0) {
      throw new ConflictException({ error: 'question_has_evidence' });
    }
    await this.repo.deleteQuestion(questionId);
    return { ok: true };
  }

  async createSource(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateSourceInput,
  ): Promise<ResearchSourceRow> {
    await this.loadScopedProject(projectId, scope);
    if (!String(input.title ?? '').trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['title is required'],
      });
    }
    return this.repo.createSource(projectId, input);
  }

  async patchSource(
    sourceId: number,
    scope: ClientScopeContext,
    input: PatchSourceInput,
  ): Promise<ResearchSourceRow> {
    const existing = await this.repo.getSource(sourceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    if (typeof input.keep !== 'boolean') {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['keep is required'],
      });
    }
    const updated = await this.repo.patchSourceKeep(sourceId, input.keep);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async createEvidence(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<ResearchEvidenceRow> {
    await this.loadScopedProject(projectId, scope);
    const messages = validateCreateEvidence(input);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    await this.assertSourceInProject(projectId, input.source_id);
    const { pii_class, pii_warning } = this.resolvePiiClass(input);
    const row = await this.repo.createEvidence(projectId, { ...input, pii_class }, actor);
    return pii_warning ? { ...row, pii_warning: true } : row;
  }

  async patchEvidence(
    evidenceId: number,
    scope: ClientScopeContext,
    input: PatchEvidenceInput,
  ): Promise<ResearchEvidenceRow> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    this.assertMutable(existing.qc_status);
    const merged: CreateEvidenceInput = {
      source_id: existing.source_id,
      study_id: existing.study_id,
      question_id: input.question_id !== undefined ? input.question_id : existing.question_id,
      locator: input.locator !== undefined ? input.locator : existing.locator,
      excerpt: input.excerpt !== undefined ? input.excerpt : existing.excerpt,
      value_num: input.value_num !== undefined ? input.value_num : existing.value_num,
      unit: input.unit !== undefined ? input.unit : existing.unit,
      value_base: input.value_base !== undefined ? input.value_base : existing.value_base,
      period_note: input.period_note !== undefined ? input.period_note : existing.period_note,
      geography: input.geography !== undefined ? input.geography : existing.geography,
      pii_class: input.pii_class !== undefined ? input.pii_class : existing.pii_class,
    };
    const messages = validateCreateEvidence(merged);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    const { pii_class, pii_warning } = this.resolvePiiClass({
      ...merged,
      pii_class: input.pii_class,
    });
    const updated = await this.repo.patchEvidence(evidenceId, { ...input, pii_class });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return pii_warning ? { ...updated, pii_warning: true } : updated;
  }

  async verifyEvidence(
    evidenceId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchEvidenceRow> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    this.assertMutable(existing.qc_status);
    const checksum = evidenceChecksum(existing);
    let updated: ResearchEvidenceRow | null;
    try {
      updated = await this.repo.verifyEvidence(evidenceId, checksum);
    } catch (err) {
      const pgCode = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (pgCode === '23505') {
        throw new ConflictException({ error: 'evidence_duplicate_checksum' });
      }
      throw err;
    }
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async supersedeEvidence(
    evidenceId: number,
    scope: ClientScopeContext,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<{ old: ResearchEvidenceRow; evidence: ResearchEvidenceRow }> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const body: CreateEvidenceInput = {
      source_id: input.source_id ?? existing.source_id,
      study_id: input.study_id ?? existing.study_id,
      question_id: input.question_id !== undefined ? input.question_id : existing.question_id,
      locator: input.locator ?? existing.locator,
      excerpt: input.excerpt !== undefined ? input.excerpt : existing.excerpt,
      value_num: input.value_num !== undefined ? input.value_num : existing.value_num,
      unit: input.unit !== undefined ? input.unit : existing.unit,
      value_base: input.value_base !== undefined ? input.value_base : existing.value_base,
      period_note: input.period_note !== undefined ? input.period_note : existing.period_note,
      geography: input.geography !== undefined ? input.geography : existing.geography,
      pii_class: input.pii_class,
    };
    const messages = validateCreateEvidence(body);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    await this.assertSourceInProject(existing.project_id, body.source_id);
    const { pii_class, pii_warning } = this.resolvePiiClass(body);
    const result = await this.repo.supersedeEvidence(
      existing,
      { ...body, pii_class },
      actor,
    );
    return pii_warning ? { ...result, evidence: { ...result.evidence, pii_warning: true } } : result;
  }

  async createInsight(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateInsightInput,
    actor: string,
  ): Promise<ResearchInsightRow> {
    await this.loadScopedProject(projectId, scope);
    if (!String(input.statement ?? '').trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['statement is required'],
      });
    }
    return this.repo.createInsight(projectId, input, actor);
  }

  async patchInsight(
    insightId: number,
    scope: ClientScopeContext,
    input: PatchInsightInput,
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    this.assertInsightContentMutable(existing.status);
    if (input.statement != null && !input.statement.trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['statement is required'],
      });
    }
    const updated = await this.repo.patchInsight(insightId, input);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async attachEvidence(
    insightId: number,
    scope: ClientScopeContext,
    evidenceIds: number[],
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    this.assertInsightContentMutable(existing.status);
    const ids = (Array.isArray(evidenceIds) ? evidenceIds : [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    const verifiedIds: number[] = [];
    for (const id of ids) {
      const ev = await this.repo.getEvidence(id);
      if (!ev || ev.project_id !== existing.project_id) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['evidence_ids is invalid'],
        });
      }
      if (ev.qc_status === 'verified') verifiedIds.push(id);
    }
    await this.repo.replaceInsightEvidence(insightId, verifiedIds);
    const nextStatus =
      existing.status === 'draft' || existing.status === 'evidence_attached'
        ? verifiedIds.length >= 1
          ? 'evidence_attached'
          : 'draft'
        : existing.status;
    if (nextStatus !== existing.status) {
      const updated = await this.repo.updateInsightStatus(insightId, nextStatus);
      if (!updated) throw new NotFoundException({ error: 'not_found' });
      return updated;
    }
    const refreshed = await this.repo.getInsight(insightId);
    if (!refreshed) throw new NotFoundException({ error: 'not_found' });
    return refreshed;
  }

  async submitReview(insightId: number, scope: ClientScopeContext): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    if (existing.status !== 'draft' && existing.status !== 'evidence_attached' && existing.status !== 'rejected') {
      throw new ConflictException({ error: 'invalid_transition' });
    }
    this.assertInsightGate(await this.repo.countVerifiedEvidenceForInsight(insightId), existing.confidence_rationale);
    const updated = await this.repo.updateInsightStatus(insightId, 'analyst_verified');
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async approveInsight(
    insightId: number,
    scope: ClientScopeContext,
    input: ApproveInsightInput,
    reviewer: string,
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    try {
      assertNotSelfApprove(existing.created_by, reviewer);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'cannot_self_approve') {
        throw new ForbiddenException({ error: 'cannot_self_approve' });
      }
      throw err;
    }
    const target = String(input.target_status ?? '') as InsightStatus;
    if (!INSIGHT_STATUSES.includes(target)) {
      throw new ConflictException({ error: 'invalid_transition' });
    }
    if (target === 'approved_internal' || target === 'approved_client_facing') {
      this.assertInsightGate(
        await this.repo.countVerifiedEvidenceForInsight(insightId),
        existing.confidence_rationale,
      );
    }
    const project = await this.repo.getProject(existing.project_id);
    if (!canApproveTarget(existing.status, target, project?.risk_class ?? 'low')) {
      throw new ConflictException({ error: 'invalid_transition' });
    }
    const updated = await this.repo.updateInsightStatus(insightId, target);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    await this.repo.insertReview({
      project_id: existing.project_id,
      object_type: 'insight',
      object_id: insightId,
      reviewer,
      role: 'approver',
      decision: target === 'rejected' ? 'reject' : 'approve',
      comments: input.comments ?? null,
    });
    return updated;
  }

  async runDesk(
    projectId: number,
    scope: ClientScopeContext,
    input: RunDeskInput,
    actor: string,
  ): Promise<RunDeskResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const questionId = Number(input.question_id);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_id is required'],
      });
    }
    const question = await this.repo.getQuestion(questionId);
    if (!question || question.project_id !== projectId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const inFlight = await this.repo.findInFlightDeskRun(projectId, questionId);
    if (inFlight) {
      throw new ConflictException({ error: 'job_in_flight' });
    }
    const run = await this.repo.insertAiRun({
      projectId,
      questionId,
      jobType: 'desk_tavily',
      provider: 'tavily',
      actor,
    });
    const job = await this.jobQueue.enqueueResearchDeskJob({
      projectId,
      questionId,
      runId: run.id,
      clientId: project.client_id,
      idempotencyKey: `research_desk:${projectId}:${questionId}:run:${run.id}`,
    });
    if (!job) {
      await this.repo.failAiRun(run.id, 'jobs_disabled');
      return { ok: true, run_id: run.id, status: 'failed', note: 'jobs_disabled' };
    }
    return { ok: true, run_id: run.id, status: 'pending' };
  }

  async getJob(
    projectId: number,
    runId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchAiRunRow> {
    await this.loadScopedProject(projectId, scope);
    const run = await this.repo.getAiRun(projectId, runId);
    if (!run) throw new NotFoundException({ error: 'not_found' });
    return run;
  }

  private async loadScopedInsight(
    insightId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchInsightRow> {
    const existing = await this.repo.getInsight(insightId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    return existing;
  }

  private assertInsightContentMutable(status: InsightStatus): void {
    if (status === 'approved_internal' || status === 'approved_client_facing' || status === 'published') {
      throw new ConflictException({ error: 'invalid_transition' });
    }
  }

  private assertInsightGate(verifiedEvidenceCount: number, confidenceRationale: string | null): void {
    const gate = evaluateInsightGate({ verifiedEvidenceCount, confidenceRationale });
    if (!gate.ok) {
      throw new BadRequestException({ error: gate.error, messages: gate.messages });
    }
  }

  private assertMutable(qcStatus: string): void {
    try {
      assertEvidenceMutable(qcStatus);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'evidence_immutable') {
        throw new ConflictException({ error: 'evidence_immutable' });
      }
      throw err;
    }
  }

  private resolvePiiClass(input: CreateEvidenceInput): { pii_class: string; pii_warning: boolean } {
    const provided = input.pii_class != null && String(input.pii_class).trim() !== '';
    if (input.excerpt && piiHint(input.excerpt) && !provided) {
      return { pii_class: 'internal', pii_warning: true };
    }
    return { pii_class: provided ? String(input.pii_class).trim() : 'none', pii_warning: false };
  }

  private async assertSourceInProject(projectId: number, sourceId?: number | null): Promise<void> {
    if (sourceId == null) return;
    const source = await this.repo.getSource(sourceId);
    if (!source || source.project_id !== projectId) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['source_id is invalid'],
      });
    }
  }

  private async toDetail(project: ResearchProjectRow): Promise<ResearchProjectDetail> {
    const [questions, sources, evidence, insights, ai_runs, tavily_credits_used] = await Promise.all([
      this.repo.listQuestions(project.id),
      this.repo.listSources(project.id),
      this.repo.listEvidence(project.id),
      this.repo.listInsights(project.id),
      this.repo.listRecentAiRuns(project.id),
      this.repo.sumTavilyCredits(project.id),
    ]);
    return {
      ...project,
      questions,
      sources,
      evidence,
      insights,
      ai_runs,
      tavily_credits_used,
      tavily_credits_limit: MAX_TAVILY_CREDITS_PER_RESEARCH,
      valid_transitions: listValidTransitions(project.status, {
        rqCount: project.rq_count,
        verifiedInsightCount: project.verified_insight_count,
      }),
    };
  }
}
