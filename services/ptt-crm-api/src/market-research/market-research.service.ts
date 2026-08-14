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
import type {
  CreateProjectInput,
  CreateQuestionInput,
  ListProjectsFilters,
  PatchProjectInput,
  PatchQuestionInput,
  ResearchProjectDetail,
  ResearchProjectRow,
  ResearchQuestionRow,
} from './market-research.types';
import { validateCreateProject } from './market-research.validation';
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

  private async toDetail(project: ResearchProjectRow): Promise<ResearchProjectDetail> {
    const questions = await this.repo.listQuestions(project.id);
    return {
      ...project,
      questions,
      valid_transitions: listValidTransitions(project.status, {
        rqCount: project.rq_count,
        verifiedInsightCount: project.verified_insight_count,
      }),
    };
  }
}
