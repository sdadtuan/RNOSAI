import { HttpException, Injectable, Optional } from '@nestjs/common';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { readImageSopFlags } from './cp-image-sop.flags';
import {
  assertG1Passed,
  assertOfficialLockup,
  assertPackBeforeG3,
  assertSelectBeforeRefine,
} from './cp-image-sop-gates.util';
import { listIntentCatalog } from './cp-image-sop-intents.util';
import { evaluateQuality } from './cp-image-sop-quality.util';
import { compileRecipe } from './cp-image-sop-recipe.util';
import { CpImageSopRepository } from './cp-image-sop.repository';
import type {
  ImgIntent,
  ImgQcProfile,
  ImgRecipeStage,
} from './cp-image-sop.types';
import type { CpJobsService } from './cp-jobs.service';

@Injectable()
export class CpImageSopService {
  private readonly env: NodeJS.ProcessEnv;

  constructor(
    private readonly repo: CpImageSopRepository,
    @Optional() private readonly cpJobs?: CpJobsService,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.env = env;
  }

  assertEnabled(env: NodeJS.ProcessEnv = this.env): void {
    if (!readImageSopFlags(env).enabled) {
      imgThrow(404, { error: 'image_sop_disabled', gate: 'GT-I01' });
    }
  }

  flags(env: NodeJS.ProcessEnv = this.env) {
    const f = readImageSopFlags(env);
    return { enabled: f.enabled, router: f.router };
  }

  async dashboardKpis() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const approved = await this.repo.countApprovedAssets(monthStart, monthEnd);
    const cycle = await this.repo.avgBriefToApprovedHours();
    const charged = await this.repo.sumLedgerImageSop();
    const explored = await this.repo.countExploredStages();
    const costPerApproved =
      approved != null && approved > 0 && charged != null ? charged / approved : null;
    const firstPassRate =
      approved != null && explored != null && explored > 0 ? approved / explored : null;
    return {
      approved_month: approved,
      brief_to_approved_hours: cycle,
      cost_per_approved: costPerApproved,
      first_pass_rate: firstPassRate,
    };
  }

  async listIntents() {
    const flags = readAiOpsFlags(this.env);
    const hasMagnific = (await this.repo.countMagnificConnections()) > 0;
    const items: Array<{
      intent: ImgIntent;
      capability: string;
      health: 'ok' | 'blocked' | 'fallback' | 'hidden';
      decision: string;
    }> = [];

    for (const meta of listIntentCatalog()) {
      const recipe = compileRecipe({
        intent: meta.intent,
        flags,
        hasMagnificConnection: hasMagnific,
      });
      let health: 'ok' | 'blocked' | 'fallback' | 'hidden' = 'ok';
      let decision = 'Route via compiled recipe';
      if (recipe.blocked_reason === 'magnific_disconnected') {
        health = meta.intent === 'format_pack' ? 'fallback' : 'blocked';
        decision = health === 'fallback' ? 'Local sharp fallback for pack' : 'Magnific disconnected';
      } else if (recipe.blocked_reason === 'weave_disabled') {
        health = 'blocked';
        decision = 'Weave disabled';
      }
      items.push({
        intent: meta.intent,
        capability: meta.primaryCapability,
        health,
        decision,
      });
    }
    return items;
  }

  async previewRouter(input: { intent: ImgIntent; data_class: string }) {
    const flags = readAiOpsFlags(this.env);
    const hasMagnific = (await this.repo.countMagnificConnections()) > 0;
    const compiled = compileRecipe({
      intent: input.intent,
      flags,
      hasMagnificConnection: hasMagnific,
    });
    return {
      stages: compiled.stages,
      blocked_reason: compiled.blocked_reason,
      data_class: input.data_class,
    };
  }

  async draftJob(
    input: {
      agency_client_id: number;
      service_lifecycle_id?: string | null;
      sop_version_id: string;
      intent: ImgIntent;
      variants: number;
      creative_direction: string;
      idempotency_key: string;
    },
    staffId: number,
  ) {
    this.assertEnabled();
    const flags = readImageSopFlags(this.env);
    if (!input.agency_client_id || input.agency_client_id <= 0) {
      imgThrow(400, { error: 'agency_client_id_required' });
    }
    if (input.variants < 1 || input.variants > flags.variantMax) {
      imgThrow(400, { error: 'variants_out_of_range', max: flags.variantMax });
    }

    const aiFlags = readAiOpsFlags(this.env);
    const hasMagnific = (await this.repo.countMagnificConnections()) > 0;
    const compiled = compileRecipe({
      intent: input.intent,
      flags: aiFlags,
      hasMagnificConnection: hasMagnific,
    });

    const project = await this.repo.insertProject({
      agency_client_id: input.agency_client_id,
      service_lifecycle_id: input.service_lifecycle_id ?? null,
      sop_version_id: input.sop_version_id,
      name: input.creative_direction.slice(0, 120) || 'Image job',
      brief_json: { creative_direction: input.creative_direction, variants: input.variants },
      created_by_staff_id: staffId,
    });

    const frame = await this.repo.insertFrame({
      project_id: project.id,
      intent: input.intent,
      aspect_ratio: '4:5',
      label: 'Frame 1',
      variant_target: input.variants,
    });

    const estimate = estimateRecipeCredits(compiled.stages);
    const job = await this.repo.insertJob({
      project_id: project.id,
      frame_id: frame.id,
      provider: compiled.stages[0]?.provider ?? 'local',
      route_decision_json: {
        intent: input.intent,
        recipe: compiled.stages,
        blocked_reason: compiled.blocked_reason,
      },
      estimate_credits: estimate,
      idempotency_key: input.idempotency_key,
    });

    return {
      job_id: job.id,
      recipe: compiled.stages,
      estimate_credits: estimate,
      blocked_reason: compiled.blocked_reason,
    };
  }

  async submitJob(jobId: string, confirm: boolean, staffId: number) {
    this.assertEnabled();
    if (confirm !== true) {
      imgThrow(400, { error: 'human_confirm_required', gate: 'GT-I04' });
    }
    const job = await this.requireJob(jobId);
    const project = await this.repo.getProject(job.project_id);
    assertG1Passed(project?.g1_at);
    await this.repo.insertStage({
      job_id: jobId,
      stage: 'explore',
      sort_order: 0,
      capability: 'submit',
      provider: job.provider,
      state: 'CONFIRMED',
    });
    return { job_id: jobId, state: 'PENDING_CONFIRM', submitted_by: staffId };
  }

  async explore(jobId: string, staffId: number) {
    this.assertEnabled();
    const job = await this.requireJob(jobId);
    const route = job.route_decision_json;
    const intent = String(route.intent ?? job.intent ?? 'hero_lifestyle') as ImgIntent;
    const aiFlags = readAiOpsFlags(this.env);
    const hasMagnific = (await this.repo.countMagnificConnections()) > 0;
    const compiled = compileRecipe({ intent, flags: aiFlags, hasMagnificConnection: hasMagnific });

    if (compiled.blocked_reason === 'magnific_disconnected' || !hasMagnific) {
      const stage = await this.repo.insertStage({
        job_id: jobId,
        stage: 'explore',
        sort_order: 0,
        capability: 'images_generate',
        provider: 'magnific_rest',
        state: 'POLICY_BLOCKED',
      });
      return { stage_id: stage.id, cp_job_id: null };
    }

    let cpJobId: string | null = null;
    if (this.cpJobs) {
      const idemKey = `image_sop:explore:${job.idempotency_key ?? jobId}`;
      const draft = await this.cpJobs.draft(
        staffId,
        {
          project_id: job.project_id,
          provider: 'magnific_rest',
          inputs: {
            capability: 'images_generate',
            estimated_credits: job.estimate_credits ?? 4,
          },
          idempotency_key: idemKey,
        },
        { hasHighCostCap: true },
      );
      await this.cpJobs.confirm(staffId, draft.job_id, { confirm: true });
      const submitted = await this.cpJobs.submit(staffId, draft.job_id);
      cpJobId = String(submitted.job_id ?? draft.job_id);
    }

    const stage = await this.repo.insertStage({
      job_id: jobId,
      stage: 'explore',
      sort_order: 0,
      capability: 'images_generate',
      provider: 'magnific_rest',
      state: cpJobId ? 'QUEUED' : 'POLICY_BLOCKED',
      cp_render_job_id: cpJobId,
    });
    return { stage_id: stage.id, cp_job_id: cpJobId };
  }

  async selectWinner(jobId: string, winnerAssetId: string, _staffId: number) {
    this.assertEnabled();
    await this.requireJob(jobId);
    await this.repo.updateJobWinner(jobId, winnerAssetId);
  }

  async refine(jobId: string, mode: 'weave' | 'overlay' | 'comfy', staffId: number) {
    this.assertEnabled();
    const job = await this.requireJob(jobId);
    assertSelectBeforeRefine(job.winner_asset_id);
    const intent = String(job.intent ?? job.route_decision_json.intent ?? '') as ImgIntent;
    if (mode === 'overlay') {
      assertOfficialLockup({ intent, overlayLockup: true, waiver: false });
    }
    if (mode === 'weave' && !readAiOpsFlags(this.env).weave) {
      imgThrow(409, { error: 'weave_disabled' });
    }
    await this.repo.insertStage({
      job_id: jobId,
      stage: 'refine',
      sort_order: 2,
      capability: mode === 'weave' ? 'weave_refine' : mode === 'overlay' ? 'overlay_lockup' : 'comfy_refine',
      provider: mode === 'weave' ? 'weavy' : mode === 'comfy' ? 'comfyui' : 'local',
      state: 'COMPLETED',
    });
    return { job_id: jobId, mode, refined_by: staffId };
  }

  async upscale(jobId: string, staffId: number) {
    this.assertEnabled();
    const job = await this.requireJob(jobId);
    assertSelectBeforeRefine(job.winner_asset_id);
    const aiFlags = readAiOpsFlags(this.env);
    const hasMagnific = (await this.repo.countMagnificConnections()) > 0;
    if (!aiFlags.magnificRest || !hasMagnific) {
      imgThrow(409, { error: 'magnific_disconnected' });
    }

    let cpJobId: string | null = null;
    if (this.cpJobs) {
      const idemKey = `image_sop:upscale:${job.idempotency_key ?? jobId}`;
      const draft = await this.cpJobs.draft(staffId, {
        project_id: job.project_id,
        provider: 'magnific_rest',
        inputs: { capability: 'images_upscale', estimated_credits: 2 },
        idempotency_key: idemKey,
      });
      await this.cpJobs.confirm(staffId, draft.job_id, { confirm: true });
      const submitted = await this.cpJobs.submit(staffId, draft.job_id);
      cpJobId = String(submitted.job_id ?? draft.job_id);
    }

    await this.repo.insertStage({
      job_id: jobId,
      stage: 'upscale',
      sort_order: 3,
      capability: 'images_upscale',
      provider: 'magnific_rest',
      state: cpJobId ? 'QUEUED' : 'COMPLETED',
      cp_render_job_id: cpJobId,
    });
  }

  async pack(
    jobId: string,
    ratios: Array<'1:1' | '4:5' | '9:16' | '16:9'>,
    _staffId: number,
  ) {
    this.assertEnabled();
    const job = await this.requireJob(jobId);
    assertSelectBeforeRefine(job.winner_asset_id);
    const aiFlags = readAiOpsFlags(this.env);
    const hasMagnific = (await this.repo.countMagnificConnections()) > 0;
    const provider = aiFlags.magnificRest && hasMagnific ? 'magnific_rest' : 'local';
    const format_pack_json: Record<string, string | null> = {};
    for (const ratio of ratios) {
      format_pack_json[ratio] = job.winner_asset_id ?? null;
    }
    if (job.frame_id) {
      await this.repo.updateFormatPack(job.frame_id, format_pack_json);
    }
    await this.repo.insertStage({
      job_id: jobId,
      stage: 'pack',
      sort_order: 4,
      capability: provider === 'local' ? 'images_crop' : 'images_crop',
      provider,
      state: 'COMPLETED',
    });
    return { format_pack_json };
  }

  evaluateQuality(input: {
    profile: ImgQcProfile;
    checks: Parameters<typeof evaluateQuality>[0]['checks'];
  }) {
    return evaluateQuality(input);
  }

  async passGate(
    projectId: string,
    gateNum: 1 | 2 | 3,
    actorStaffId: number,
    checklist: Record<string, unknown>,
  ) {
    this.assertEnabled();
    const project = await this.repo.getProject(projectId);
    if (!project) imgThrow(404, { error: 'project_not_found' });
    if (gateNum === 3) {
      const jobs = (await this.repo.listJobs()).filter((j) => j.project_id === projectId);
      const pack = jobs[0]?.format_pack_json ?? null;
      assertPackBeforeG3(pack);
    }
    await this.repo.insertGateLog({
      project_id: projectId,
      gate_num: gateNum,
      action: 'pass',
      actor_staff_id: actorStaffId,
      checklist_json: checklist,
    });
    await this.repo.updateProjectGate(projectId, gateNum);
  }

  async listSops() {
    const rows = await this.repo.listSops();
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      status: row.status,
      version: row.version,
      intent: row.intent,
    }));
  }

  async createSop(
    input: {
      code: string;
      name: string;
      category: string;
      data_class: string;
      outcome: string;
    },
    staffId: number,
  ) {
    const created = await this.repo.insertSop({
      code: input.code,
      name: input.name,
      category: input.category,
      data_class: input.data_class,
      owner_staff_id: staffId,
    });
    return created;
  }

  async saveVersion(
    sopId: string,
    input: {
      version: string;
      manifest_json: Record<string, unknown>;
      creative_genome: Record<string, unknown>;
      prompt_package_id?: string | null;
    },
    _staffId: number,
  ) {
    const manifest = {
      ...input.manifest_json,
      creative_genome: input.creative_genome,
    };
    return this.repo.insertSopVersion({
      sop_id: sopId,
      version: input.version,
      manifest_json: manifest,
      prompt_package_id: input.prompt_package_id ?? null,
    });
  }

  async getBrandGraph(kitId: string) {
    const kit = await this.repo.getBrandKit(kitId);
    const rules = kit ? await this.repo.listBrandRules(kitId) : [];
    return { kit, rules };
  }

  async listImageAssets() {
    return this.repo.listImageAssets();
  }

  async assetProvenance(assetId: string) {
    return {
      events: [
        { label: 'Asset registered', detail: assetId },
        { label: 'Provenance', detail: 'image_sop pipeline' },
      ],
    };
  }

  async finopsSummary() {
    const charged = await this.repo.sumLedgerImageSop();
    const byProvider = await this.repo.finopsByProvider();
    return {
      charged,
      reserved: null,
      by_provider: byProvider,
    };
  }

  async governanceAudit() {
    const items = await this.repo.listGovernanceAudit();
    return { items };
  }

  async operationsBoard() {
    const projects = await this.repo.listProjectsForBoard({ staffId: 0, scope: 'all' });
    return {
      columns: {
        brief: projects.filter((p) => !p.g1_at),
        prod: projects.filter((p) => p.g1_at && !p.g2_at),
        internal: projects.filter((p) => p.g2_at && !p.g3_at),
        client: projects.filter((p) => p.g3_at),
      },
    };
  }

  listJobs() {
    return this.repo.listJobs();
  }

  private async requireJob(jobId: string) {
    const job = await this.repo.getJob(jobId);
    if (!job) imgThrow(404, { error: 'job_not_found' });
    return job;
  }
}

function estimateRecipeCredits(stages: ImgRecipeStage[]): number | null {
  const credits = stages
    .map((s) => s.estimate_credits)
    .filter((v): v is number => v != null);
  if (credits.length === 0) return stages.some((s) => s.provider === 'magnific_rest') ? 4 : null;
  return credits.reduce((sum, n) => sum + n, 0);
}

function imgThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
