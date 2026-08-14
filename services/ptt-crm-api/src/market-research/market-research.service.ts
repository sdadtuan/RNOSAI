import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientScopeContext, StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { PROJECT_STATUSES, type ProjectStatus } from './market-research.constants';
import { MarketResearchRepository } from './market-research.repository';
import { evidenceChecksum } from './evidence-checksum.util';
import { assertEvidenceMutable, piiHint } from './evidence-immutable.util';
import type {
  CreateEvidenceInput,
  CreateProjectInput,
  CreateQuestionInput,
  CreateSourceInput,
  ListProjectsFilters,
  PatchEvidenceInput,
  PatchProjectInput,
  PatchQuestionInput,
  PatchSourceInput,
  ResearchEvidenceRow,
  ResearchProjectDetail,
  ResearchProjectRow,
  ResearchQuestionRow,
  ResearchSourceRow,
} from './market-research.types';
import { validateCreateEvidence, validateCreateProject } from './market-research.validation';
import { canTransitionProject, listValidTransitions } from './project-state.util';

@Injectable()
export class MarketResearchService {
  constructor(
    private readonly repo: MarketResearchRepository,
    private readonly clientScope: StaffClientScopeService,
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
    const updated = await this.repo.verifyEvidence(evidenceId, checksum);
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
    const [questions, sources, evidence] = await Promise.all([
      this.repo.listQuestions(project.id),
      this.repo.listSources(project.id),
      this.repo.listEvidence(project.id),
    ]);
    return {
      ...project,
      questions,
      sources,
      evidence,
      valid_transitions: listValidTransitions(project.status, {
        rqCount: project.rq_count,
        verifiedInsightCount: project.verified_insight_count,
      }),
    };
  }
}
