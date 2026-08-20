import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { parseIdeaSummaries, selectTextGen, STUB_IDEAS } from '../adapters/i-text-gen';
import { VdDispatcherService } from '../orchestration/vd-dispatcher.service';
import type { VdScriptRow } from '../project/vd-project.repository';
import { VdProjectRepository } from '../project/vd-project.repository';
import { assertStageTransition } from '../rules/vd-stage.guard';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdIdeaRepository, type VdIdeaRow, type VdPromptTemplateRow } from './vd-idea.repository';
import { VdShotRepository, type VdShotRow } from './vd-shot.repository';

export type { VdIdeaRow, VdPromptTemplateRow, VdScriptRow, VdShotRow };

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

@Injectable()
export class VdScriptService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly ideas: VdIdeaRepository,
    private readonly shots: VdShotRepository,
    private readonly dispatcher: VdDispatcherService,
  ) {}

  private async requireProject(id: number) {
    const row = await this.projects.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }

  private async requireScript(id: number): Promise<VdScriptRow> {
    const row = await this.projects.getScriptById(id);
    if (!row) throw new Error('vd_script_not_found');
    return row;
  }

  async materializeStubIdeas(projectId: number): Promise<VdIdeaRow[]> {
    const gen = selectTextGen({ OPENAI_API_KEY: '' });
    const result = await gen.complete({ system: 'director', user: 'ideas' });
    const summaries = parseIdeaSummaries(result);
    return this.ideas.replaceForProject(projectId, summaries.length === 3 ? summaries : [...STUB_IDEAS]);
  }

  async applyDirectorResult(projectId: number, result: unknown): Promise<VdIdeaRow[]> {
    const summaries = parseIdeaSummaries(result);
    return this.ideas.replaceForProject(projectId, summaries);
  }

  async generateIdeas(
    projectId: number,
    idempotencyKey: string | undefined,
  ): Promise<{ id: number; status: 'queued' }> {
    const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
    if (!key) throw new Error('idempotency_key_required');
    assertCinematicEnabled(this.config);
    const project = await this.requireProject(projectId);
    if (project.stage !== 'brief_ready' && project.stage !== 'ideation') {
      throw new Error('stage_guard');
    }
    if (project.stage === 'brief_ready') {
      assertStageTransition(project.stage, 'ideation');
      await this.projects.updateStage(projectId, 'ideation');
    }
    const row = await this.dispatcher.enqueue({
      projectId,
      queue: 'q.text',
      jobType: 'cine_director',
      payload: {},
      idempotencyKey: key,
    });
    return { id: row.id, status: 'queued' };
  }

  async listIdeas(projectId: number): Promise<VdIdeaRow[]> {
    await this.requireProject(projectId);
    return this.ideas.listByProjectId(projectId);
  }

  async selectIdea(projectId: number, ideaId: number): Promise<VdIdeaRow[]> {
    assertCinematicEnabled(this.config);
    await this.requireProject(projectId);
    return this.ideas.selectIdea(projectId, ideaId);
  }

  async listScripts(projectId: number): Promise<VdScriptRow[]> {
    await this.requireProject(projectId);
    return this.projects.listScripts(projectId);
  }

  async createScript(projectId: number, body: Record<string, unknown>): Promise<VdScriptRow> {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    const markdown = typeof body.markdown === 'string' ? body.markdown : '';
    const project = await this.requireProject(projectId);
    if (project.stage === 'brief_ready' || project.stage === 'ideation') {
      assertStageTransition(project.stage, 'scripting');
      await this.projects.updateStage(projectId, 'scripting');
    } else if (project.stage !== 'scripting') {
      throw new Error('stage_guard');
    }
    const existing = await this.projects.listScripts(projectId);
    const version = existing.length === 0 ? 1 : Math.max(...existing.map((s) => s.version)) + 1;
    return this.projects.insertScriptRow(projectId, version, markdown);
  }

  async listShots(scriptId: number): Promise<VdShotRow[]> {
    await this.requireScript(scriptId);
    return this.shots.listByScriptId(scriptId);
  }

  async addShot(scriptId: number, body: Record<string, unknown>): Promise<VdShotRow> {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    await this.requireScript(scriptId);
    const duration = Number(body.duration_ms);
    if (!Number.isFinite(duration)) {
      throw new Error('invalid_body');
    }
    const seedRaw = body.seed;
    const seed =
      seedRaw == null || seedRaw === ''
        ? null
        : Number.isFinite(Number(seedRaw))
          ? Number(seedRaw)
          : null;
    return this.shots.insert({
      script_id: scriptId,
      duration_ms: Math.floor(duration),
      camera: typeof body.camera === 'string' ? body.camera : '',
      action: typeof body.action === 'string' ? body.action : '',
      aspect: typeof body.aspect === 'string' ? body.aspect : undefined,
      contains_human: asBool(body.contains_human),
      text_in_frame: asBool(body.text_in_frame),
      logo_in_ai_frame: asBool(body.logo_in_ai_frame),
      seed,
    });
  }

  listTemplates(): Promise<VdPromptTemplateRow[]> {
    return this.ideas.listTemplates();
  }
}
