import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { CpAssetsService } from './cp-assets.service';
import { bindComfyWorkflow } from './cp-comfy-bind.util';
import { CpComfyAdapter } from './cp-comfy.adapter';
import { CpJobsRepository } from './cp-jobs.repository';
import { CpLedgerService } from './cp-ledger.service';
import { assertMagnificAllowed } from './cp-magnific-policy.util';
import { probeIngestBytes } from './cp-media-probe.util';
import { CpSettingsService } from './cp-settings.service';

export const MAGNIFIC_ADAPTER = 'MAGNIFIC_ADAPTER';

export type CpJobProvider = 'magnific_mcp' | 'magnific_rest' | 'comfyui';

export type CpJobDraftInput = {
  project_id: string;
  task_id?: string;
  template_id?: string;
  provider: CpJobProvider;
  provider_mode?: 'manual' | 'recommended';
  prompt_package_id?: string | null;
  inputs: Record<string, unknown>;
  idempotency_key: string;
};

export type CpJobDraftResult = {
  job_id: string;
  status: 'draft' | 'pending_confirm';
  estimate: { credits: number | null; duration_sec: number | null };
  requires_confirmation: boolean;
};

export type CpJobsAuth = {
  hasHighCostCap?: boolean;
};

export interface MagnificAdapterPort {
  getBalance(transport?: 'mcp' | 'rest'): Promise<{ credits: number | null }>;
  generate(input: {
    transport: 'mcp' | 'rest';
    capability: string;
    inputs: Record<string, unknown>;
  }): Promise<{ externalRunId: string }>;
  wait(
    externalRunId: string,
    transport?: 'mcp' | 'rest',
  ): Promise<{ outputUrls: string[]; actualCredits: number | null }>;
  download(
    url: string,
    transport?: 'mcp' | 'rest',
  ): Promise<{ bytes: Buffer; mime: string }>;
}

@Injectable()
export class MagnificAdapterStub implements MagnificAdapterPort {
  async getBalance(): Promise<{ credits: number | null }> {
    return { credits: null };
  }

  async generate(): Promise<{ externalRunId: string }> {
    return { externalRunId: `queued-${Date.now()}` };
  }

  async wait(): Promise<{ outputUrls: string[]; actualCredits: number | null }> {
    return { outputUrls: [], actualCredits: null };
  }

  async download(): Promise<{ bytes: Buffer; mime: string }> {
    return { bytes: Buffer.alloc(0), mime: 'application/octet-stream' };
  }
}

@Injectable()
export class CpJobsService {
  constructor(
    private readonly repo: CpJobsRepository,
    private readonly ledger: CpLedgerService,
    @Inject(MAGNIFIC_ADAPTER) private readonly adapter: MagnificAdapterPort,
    @Optional() private readonly settings?: CpSettingsService,
    @Optional() private readonly assets?: CpAssetsService,
    @Optional() private readonly comfy?: CpComfyAdapter,
  ) {}

  async draft(
    staffId: number,
    input: CpJobDraftInput,
    auth: CpJobsAuth = {},
  ): Promise<CpJobDraftResult> {
    const projectId = String(input.project_id ?? '').trim();
    if (!projectId) cpThrow(422, { error: 'project_id_required', gate: 'GT-A01' });
    const provider = requiredProvider(input.provider);
    const key = requiredText(input.idempotency_key, 'idempotency_key_required');
    const inputs = objectValue(input.inputs);

    const project = await this.loadProject(projectId);
    this.assertPolicy(provider, project, inputs);

    const existing = await this.repo.findByIdempotencyKey(key);
    if (existing.rows[0]) return toDraftResult(existing.rows[0]);

    const estimate = estimateFromInputs(inputs);
    await this.assertHighCost(estimate.credits, auth.hasHighCostCap !== false);

    const requiresConfirmation = estimate.credits == null || estimate.credits > 0;
    const status: 'draft' | 'pending_confirm' = requiresConfirmation
      ? 'pending_confirm'
      : 'draft';
    const stageLog = {
      inputs,
      estimate,
      prompt_package_id: input.prompt_package_id ?? null,
      provider_mode: input.provider_mode ?? 'manual',
      template_id: input.template_id ?? null,
      confirmed: false,
      reserved_amount: null,
      created_by: staffId,
      agency_client_id: nullableText(project.agency_client_id),
      cost_center: nullableText(project.cost_center),
      classification: policyClassification(project, inputs),
      external_prohibited: policyExternalProhibited(project, inputs),
      attempt: 1,
    };
    const inserted = await this.repo.insertJob({
      projectId,
      taskId: nullableText(input.task_id),
      state: status,
      provider,
      model: nullableText(inputs.capability),
      stageLog,
      createdByStaffId: staffId,
      idempotencyKey: key,
      correlationId: `${key}:${Date.now()}`,
    });
    const job = inserted.rows[0];
    if (!job) {
      const raced = await this.repo.findByIdempotencyKey(key);
      if (raced.rows[0]) return toDraftResult(raced.rows[0]);
      cpThrow(500, { error: 'job_insert_failed' });
    }
    return toDraftResult(job);
  }

  async confirm(
    staffId: number,
    jobId: string,
    body: { confirm: boolean },
  ): Promise<Record<string, unknown>> {
    if (body?.confirm !== true) {
      cpThrow(400, { error: 'human_confirm_required' });
    }
    const job = await this.loadJob(jobId);
    const log = stageLogOf(job);
    const replay = this.assertConfirmable(job, log);
    if (replay) return replay;
    const provider = requiredProvider(job.provider);
    await this.assertDurablePolicy(provider, job, log);
    const estimate = estimateFromLog(log);
    await this.assertHighCost(estimate.credits, true);

    const attempt = jobAttempt(job, log);
    if (estimate.credits != null) {
      await this.reserveCredits(job, log, provider, estimate.credits, attempt);
    }
    log.confirmed = true;
    log.confirmed_by = staffId;
    const updated = await this.repo.updateJob(String(job.id), {
      state: 'pending_confirm',
      stageLog: log,
    });
    return updated.rows[0] ?? { ...job, state: 'pending_confirm' };
  }

  async submit(staffId: number, jobId: string): Promise<Record<string, unknown>> {
    const job = await this.loadJob(jobId);
    const log = stageLogOf(job);
    const provider = requiredProvider(job.provider);
    await this.assertDurablePolicy(provider, job, log);
    this.assertSubmittable(job, log);
    const estimate = estimateFromLog(log);
    if (provider === 'comfyui') {
      return this.submitComfy(staffId, job, log, estimate);
    }

    const inputs = objectValue(log.inputs);
    const capability = String(inputs.capability ?? job.model ?? 'images_generate');
    const transport = provider === 'magnific_rest' ? 'rest' : 'mcp';
    const balance = await this.adapter.getBalance(transport);
    if (balance.credits == null) {
      cpThrow(409, { error: 'POLICY_BLOCKED', gate: 'GT-M02' });
    }
    try {
      const generated = await this.adapter.generate({
        transport,
        capability,
        inputs,
      });
      log.external_run_id = generated.externalRunId;
      log.submitted_by = staffId;
      await this.repo.insertRun({
        jobId: String(job.id),
        provider,
        mode: log.provider_mode === 'recommended' ? 'auto' : 'manual',
        externalRunId: generated.externalRunId,
        toolOrWorkflow: capability,
        estimateCredits: estimate.credits,
        status: 'queued',
      });
      const updated = await this.repo.updateJob(String(job.id), {
        state: 'queued',
        stageLog: log,
      });
      return {
        job_id: String(job.id),
        status: 'queued',
        external_run_id: generated.externalRunId,
        ...(updated.rows[0] ?? {}),
      };
    } catch (error) {
      await this.releaseCredits(job, log, provider, estimate.credits);
      log.release_reason = 'submit_failed';
      log.confirmed = false;
      log.reserved_amount = null;
      await this.repo.updateJob(String(job.id), { state: 'failed', stageLog: log }).catch(() => undefined);
      throw error;
    }
  }

  async cancel(_staffId: number, jobId: string): Promise<Record<string, unknown>> {
    const job = await this.loadJob(jobId);
    if (['completed', 'cancelled', 'expired'].includes(String(job.state))) {
      cpThrow(409, { error: 'job_not_cancellable' });
    }
    const log = stageLogOf(job);
    const provider = requiredProvider(job.provider);
    if (provider === 'comfyui' && String(log.external_run_id ?? '').trim()) {
      await this.comfy?.interrupt(String(log.external_run_id)).catch(() => undefined);
    }
    await this.releaseCredits(
      job,
      log,
      provider,
      nullableInteger(log.reserved_amount),
    );
    const updated = await this.repo.updateJob(String(job.id), {
      state: 'cancelled',
      stageLog: {
        ...log,
        cancelled: true,
        confirmed: false,
        reserved_amount: null,
      },
    });
    return updated.rows[0] ?? { ...job, state: 'cancelled' };
  }

  async retry(staffId: number, jobId: string): Promise<Record<string, unknown>> {
    const job = await this.loadJob(jobId);
    if (!['failed', 'cancelled', 'expired'].includes(String(job.state))) {
      cpThrow(409, { error: 'job_not_retryable' });
    }
    const log = stageLogOf(job);
    const provider = requiredProvider(job.provider);
    await this.assertDurablePolicy(provider, job, log);
    const attempt = jobAttempt(job, log) + 1;
    const estimate = estimateFromLog(log);
    log.attempt = attempt;
    log.cancelled = false;
    log.release_reason = null;
    if (estimate.credits != null) {
      await this.reserveCredits(job, log, provider, estimate.credits, attempt);
    } else {
      log.confirmed = true;
    }
    await this.repo.updateJob(String(job.id), { state: 'pending_confirm', stageLog: log });
    return this.submit(staffId, jobId);
  }

  async get(_staffId: number, jobId: string): Promise<Record<string, unknown>> {
    return this.loadJob(jobId);
  }

  async ingest(staffId: number, jobId: string): Promise<Record<string, unknown>> {
    const id = requiredText(jobId, 'invalid_job_id');
    const claimed = await this.repo.claimQueuedForIngest(id);
    if (!claimed.rows[0]) {
      const existing = await this.repo.findById(id);
      return existing.rows[0] ?? cpThrow(404, { error: 'job_not_found' });
    }
    const job = claimed.rows[0];
    const log = stageLogOf(job);
    const provider = requiredProvider(job.provider);
    const transport = provider === 'magnific_rest' ? 'rest' : 'mcp';
    const actorId = staffId > 0 ? staffId : Number(log.created_by ?? 0) || 0;
    const capability = provider === 'comfyui'
      ? String(objectValue(log.inputs).workflow_key ?? 'comfy_prompt')
      : String(objectValue(log.inputs).capability ?? job.model ?? 'images_generate');
    const externalRunId = String(log.external_run_id ?? '').trim();
    try {
      if (!externalRunId) {
        return this.failAssetSync(job, log, provider, 'missing_external_run');
      }
      const pulled = provider === 'comfyui'
        ? await this.pullComfyOutput(job, log, provider, externalRunId)
        : await this.pullMagnificOutput(job, log, provider, externalRunId, transport);
      if (!pulled.downloaded.bytes?.length) {
        return this.failAssetSync(job, log, provider, 'empty_download');
      }
      const checksum = createHash('sha256').update(pulled.downloaded.bytes).digest('hex');
      if (!checksum) {
        return this.failAssetSync(job, log, provider, 'missing_checksum');
      }
      const probed = await probeIngestBytes(pulled.downloaded.bytes, pulled.downloaded.mime);
      log.width = probed.width;
      log.height = probed.height;
      log.duration_sec = probed.duration_sec;
      log.checksum = checksum;
      log.actual_credits = pulled.actualCredits;
      const asset = await this.copyToDam({
        job,
        log,
        provider,
        actorId,
        bytes: pulled.downloaded.bytes,
        mime: pulled.downloaded.mime,
        checksum,
        externalRunId,
        tool: capability,
      });
      log.asset_id = asset.id;
      const updated = await this.repo.updateJob(String(job.id), {
        state: 'quality_check',
        errorClass: null,
        stageLog: log,
      });
      return {
        job_id: String(job.id),
        state: 'quality_check',
        asset_id: asset.id,
        checksum,
        ...(updated.rows[0] ?? {}),
      };
    } catch (error) {
      if (isOomError(error)) {
        return this.failOom(job, log, provider);
      }
      if (isPersistedAssetSyncFailure(error)) throw error;
      return this.failAssetSync(job, log, provider, ingestFailReason(error));
    }
  }

  private async submitComfy(
    staffId: number,
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    estimate: { credits: number | null; duration_sec: number | null },
  ): Promise<Record<string, unknown>> {
    if (!readAiOpsFlags().comfy || !this.comfy) {
      cpThrow(409, { error: 'WORKER_UNAVAILABLE', gate: 'GT-C01' });
    }
    const stats = await this.comfy.systemStats();
    if (!stats.ok) {
      cpThrow(409, { error: 'WORKER_UNAVAILABLE', gate: 'GT-C01' });
    }
    const bound = bindWorkflowFromInputs(objectValue(log.inputs));
    const provider: CpJobProvider = 'comfyui';
    try {
      const generated = await this.promptComfyWithOomRetry(job, log, provider, estimate, bound);
      log.external_run_id = generated.promptId;
      log.submitted_by = staffId;
      await this.repo.insertRun({
        jobId: String(job.id),
        provider,
        mode: log.provider_mode === 'recommended' ? 'auto' : 'manual',
        externalRunId: generated.promptId,
        toolOrWorkflow: String(objectValue(log.inputs).workflow_key ?? 'comfy_prompt'),
        estimateCredits: estimate.credits,
        status: 'queued',
      });
      const updated = await this.repo.updateJob(String(job.id), {
        state: 'queued',
        stageLog: log,
      });
      return {
        job_id: String(job.id),
        status: 'queued',
        external_run_id: generated.promptId,
        ...(updated.rows[0] ?? {}),
      };
    } catch (error) {
      if (isOomError(error) && (error as { persisted?: unknown }).persisted === true) {
        throw error;
      }
      await this.releaseCredits(job, log, provider, estimate.credits);
      log.release_reason = 'submit_failed';
      log.confirmed = false;
      log.reserved_amount = null;
      await this.repo.updateJob(String(job.id), { state: 'failed', stageLog: log }).catch(() => undefined);
      throw error;
    }
  }

  private async promptComfyWithOomRetry(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    provider: CpJobProvider,
    estimate: { credits: number | null },
    bound: unknown,
  ): Promise<{ promptId: string }> {
    const comfy = this.comfy;
    if (!comfy) cpThrow(409, { error: 'WORKER_UNAVAILABLE', gate: 'GT-C01' });
    try {
      return await comfy.prompt(String(job.id), bound);
    } catch (error) {
      if (!isOomError(error) || jobAttempt(job, log) > 1) {
        if (isOomError(error)) return this.failOom(job, log, provider);
        throw error;
      }
      await this.releaseCredits(job, log, provider, estimate.credits);
      const nextAttempt = jobAttempt(job, log) + 1;
      log.attempt = nextAttempt;
      if (estimate.credits != null) {
        await this.reserveCredits(job, log, provider, estimate.credits, nextAttempt);
      }
      try {
        return await comfy.prompt(String(job.id), bound);
      } catch (retryError) {
        if (isOomError(retryError)) return this.failOom(job, log, provider);
        throw retryError;
      }
    }
  }

  private async pullMagnificOutput(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    provider: CpJobProvider,
    externalRunId: string,
    transport: 'mcp' | 'rest',
  ): Promise<{ downloaded: { bytes: Buffer; mime: string }; actualCredits: number | null }> {
    const waited = await this.adapter.wait(externalRunId, transport);
    const url = waited.outputUrls.find((item) => String(item ?? '').trim()) ?? '';
    if (!url) {
      return this.failAssetSync(job, log, provider, 'missing_output_url');
    }
    return {
      downloaded: await this.adapter.download(url, transport),
      actualCredits: waited.actualCredits,
    };
  }

  private async pullComfyOutput(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    provider: CpJobProvider,
    externalRunId: string,
  ): Promise<{ downloaded: { bytes: Buffer; mime: string }; actualCredits: number | null }> {
    if (!this.comfy) {
      return this.failAssetSync(job, log, provider, 'assets_unavailable');
    }
    const waited = await this.comfy.history(externalRunId);
    const file = waited.outputFiles.find((item) => String(item ?? '').trim()) ?? '';
    if (!file) {
      return this.failAssetSync(job, log, provider, 'missing_output_url');
    }
    return {
      downloaded: await this.comfy.download(file),
      actualCredits: null,
    };
  }

  private async copyToDam(input: {
    job: Record<string, unknown>;
    log: Record<string, unknown>;
    provider: CpJobProvider;
    actorId: number;
    bytes: Buffer;
    mime: string;
    checksum: string;
    externalRunId: string;
    tool: string;
  }): Promise<{ id: string }> {
    if (!this.assets) {
      return this.failAssetSync(input.job, input.log, input.provider, 'assets_unavailable');
    }
    const ext = extForMime(input.mime);
    const prefix = input.provider.startsWith('magnific') ? 'magnific' : input.provider;
    const storageKey = `${prefix}/${input.job.id}/${input.checksum}.${ext}`;
    const root = (process.env.CP_ASSET_STORAGE ?? process.env.MAGNIFIC_ASSET_PREFIX ?? '').trim();
    if (!root) {
      return this.failAssetSync(input.job, input.log, input.provider, 'storage_missing');
    }
    const dest = join(root, storageKey);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, input.bytes);
    const created = await this.assets.createAsset(
      {
        agency_client_id: nullableText(input.log.agency_client_id) ?? undefined,
        mime: input.mime,
        filename: `${prefix}-${input.job.id}.${ext}`,
        project_id: nullableText(input.job.project_id),
      },
      { scope: 'all', staffId: input.actorId },
    );
    const assetId = String(created.id ?? '');
    const provenance = {
      provider: input.provider,
      external_run_id: input.externalRunId,
      tool: input.tool,
      checksum: input.checksum,
    };
    await this.assets.replaceFile(
      assetId,
      {
        mime: input.mime,
        filename: `${prefix}-${input.job.id}.${ext}`,
        storage_key: storageKey,
        bytes: input.bytes.length,
        hash: input.checksum,
        meta_json: { provenance },
      },
      { scope: 'all', staffId: input.actorId },
    );
    await this.assets.finalizeIngest(
      assetId,
      { bytes: input.bytes.length, hash: input.checksum },
      { scope: 'all', staffId: input.actorId },
    );
    return { id: assetId };
  }

  private async failAssetSync(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    provider: CpJobProvider,
    reason: string,
  ): Promise<never> {
    log.error_class = 'ASSET_SYNC_FAILED';
    log.sync_fail_reason = reason;
    await this.releaseCredits(
      job,
      log,
      provider,
      nullableInteger(log.reserved_amount),
    );
    await this.repo.updateJob(String(job.id), {
      state: 'failed',
      errorClass: 'ASSET_SYNC_FAILED',
      stageLog: log,
    }).catch(() => undefined);
    const body = {
      error: 'ASSET_SYNC_FAILED',
      error_class: 'ASSET_SYNC_FAILED',
      reason,
      persisted: true,
    };
    throw Object.assign(new HttpException(body, 409), body);
  }

  private async failOom(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    provider: CpJobProvider,
  ): Promise<never> {
    log.error_class = 'OUT_OF_MEMORY';
    await this.releaseCredits(
      job,
      log,
      provider,
      nullableInteger(log.reserved_amount),
    );
    await this.repo.updateJob(String(job.id), {
      state: 'failed',
      errorClass: 'OUT_OF_MEMORY',
      stageLog: log,
    }).catch(() => undefined);
    const body = {
      error: 'OUT_OF_MEMORY',
      error_class: 'OUT_OF_MEMORY',
      persisted: true,
    };
    throw Object.assign(new HttpException(body, 409), body);
  }

  private assertConfirmable(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const state = String(job.state ?? '');
    const released = Boolean(log.release_reason) || log.cancelled === true;
    if (released || !['draft', 'pending_confirm'].includes(state)) {
      cpThrow(409, { error: 'job_not_confirmable', state });
    }
    const holdIntact = log.confirmed === true
      && (nullableInteger(log.reserved_amount) != null || estimateFromLog(log).credits == null);
    if (state === 'pending_confirm' && holdIntact) {
      return job;
    }
    if (log.confirmed === true && !holdIntact) {
      cpThrow(409, { error: 'job_not_confirmable', state });
    }
    return null;
  }

  private assertSubmittable(job: Record<string, unknown>, log: Record<string, unknown>): void {
    if (String(job.state) !== 'pending_confirm' || log.confirmed !== true) {
      cpThrow(409, {
        error: 'job_not_submittable',
        state: String(job.state ?? ''),
      });
    }
  }

  private async reserveCredits(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    provider: CpJobProvider,
    amount: number,
    attempt: number,
  ): Promise<void> {
    await this.ledger.reserve({
      amount,
      agencyClientId: nullableText(log.agency_client_id),
      projectId: nullableText(job.project_id),
      jobId: String(job.id),
      costCenter: nullableText(log.cost_center),
      idempotencyKey: reserveLedgerKey(String(job.idempotency_key), attempt),
      provider,
    });
    log.reserved_amount = amount;
    log.confirmed = true;
    log.reserve_key = reserveLedgerKey(String(job.idempotency_key), attempt);
  }

  private async releaseCredits(
    job: Record<string, unknown>,
    log: Record<string, unknown>,
    provider: CpJobProvider,
    fallbackAmount: number | null,
  ): Promise<void> {
    const reserved = Number(log.reserved_amount ?? fallbackAmount);
    if (!Number.isSafeInteger(reserved) || reserved <= 0) return;
    await this.ledger.append({
      kind: 'release',
      amount: reserved,
      agencyClientId: nullableText(log.agency_client_id),
      projectId: nullableText(job.project_id),
      jobId: String(job.id),
      costCenter: nullableText(log.cost_center),
      idempotencyKey: releaseLedgerKey(String(job.idempotency_key), jobAttempt(job, log)),
      provider,
    });
  }

  private assertPolicy(
    provider: CpJobProvider,
    project: Record<string, unknown>,
    inputs: Record<string, unknown>,
  ): void {
    if (provider === 'comfyui') return;
    assertMagnificAllowed({
      provider,
      flags: readAiOpsFlags(),
      classification: policyClassification(project, inputs),
      externalProhibited: policyExternalProhibited(project, inputs),
    });
  }

  private async assertDurablePolicy(
    provider: CpJobProvider,
    job: Record<string, unknown>,
    log: Record<string, unknown>,
  ): Promise<void> {
    const inputs = objectValue(log.inputs);
    this.assertPolicy(provider, {
      classification: log.classification,
      external_prohibited: log.external_prohibited,
    }, inputs);
    const projectId = nullableText(job.project_id);
    if (!projectId) return;
    const project = (await this.repo.loadProject(projectId)).rows[0];
    if (!project) return;
    if (
      nullableText(project.classification) != null
      || project.external_prohibited === true
      || project.external_prohibited === false
    ) {
      this.assertPolicy(provider, project, inputs);
    }
  }

  private async assertHighCost(
    credits: number | null,
    hasHighCostCap: boolean,
  ): Promise<void> {
    if (credits == null) return;
    const settings = await this.settings?.get();
    const threshold = nullableInteger(settings?.high_cost_threshold) ?? 200;
    if (credits > threshold && !hasHighCostCap) {
      cpThrow(403, {
        error: 'missing_cap',
        section: 'crm_cp.render_high_cost',
        action: 'execute',
      });
    }
  }

  private async loadProject(projectId: string): Promise<Record<string, unknown>> {
    const result = await this.repo.loadProject(projectId);
    return result.rows[0] ?? cpThrow(422, { error: 'project_not_found', gate: 'GT-A01' });
  }

  private async loadJob(jobId: string): Promise<Record<string, unknown>> {
    const id = requiredText(jobId, 'invalid_job_id');
    const result = await this.repo.findById(id);
    return result.rows[0] ?? cpThrow(404, { error: 'job_not_found' });
  }
}

function toDraftResult(job: Record<string, unknown>): CpJobDraftResult {
  const log = stageLogOf(job);
  const estimate = estimateFromLog(log);
  const status = String(job.state) === 'draft' ? 'draft' : 'pending_confirm';
  return {
    job_id: String(job.id),
    status,
    estimate,
    requires_confirmation: estimate.credits == null || estimate.credits > 0,
  };
}

function policyClassification(
  source: Record<string, unknown>,
  inputs: Record<string, unknown> = {},
): string | null {
  return nullableText(source.classification) ?? nullableText(inputs.classification);
}

function policyExternalProhibited(
  source: Record<string, unknown>,
  inputs: Record<string, unknown> = {},
): boolean {
  return source.external_prohibited === true
    || inputs.external_prohibited === true
    || inputs.externalProhibited === true;
}

function jobAttempt(job: Record<string, unknown>, log: Record<string, unknown>): number {
  const fromLog = nullableInteger(log.attempt);
  const fromJob = nullableInteger(job.attempt);
  const value = fromLog ?? fromJob ?? 1;
  return value > 0 ? value : 1;
}

/** First confirm uses `reserve:{idempotency}`; later attempts use `reserve:{idempotency}:{attempt}`. */
function reserveLedgerKey(idempotency: string, attempt: number): string {
  return attempt <= 1 ? `reserve:${idempotency}` : `reserve:${idempotency}:${attempt}`;
}

/** First release uses `rel:{idempotency}`; later attempts use `rel:{idempotency}:{attempt}`. */
function releaseLedgerKey(idempotency: string, attempt: number): string {
  return attempt <= 1 ? `rel:${idempotency}` : `rel:${idempotency}:${attempt}`;
}

function estimateFromInputs(inputs: Record<string, unknown>): {
  credits: number | null;
  duration_sec: number | null;
} {
  return {
    credits: nullableInteger(inputs.estimated_credits ?? inputs.credits),
    duration_sec: nullableInteger(inputs.duration_sec),
  };
}

function estimateFromLog(log: Record<string, unknown>): {
  credits: number | null;
  duration_sec: number | null;
} {
  const nested = objectValue(log.estimate);
  return {
    credits: nullableInteger(nested.credits ?? log.estimate_credits),
    duration_sec: nullableInteger(nested.duration_sec ?? log.estimate_duration_sec),
  };
}

function stageLogOf(job: Record<string, unknown>): Record<string, unknown> {
  const raw = job.stage_log_json;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...raw as Record<string, unknown> };
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...parsed as Record<string, unknown> };
      }
    } catch {
      return {};
    }
  }
  return {};
}

function requiredProvider(value: unknown): CpJobProvider {
  const provider = String(value ?? '').trim();
  if (provider === 'magnific_mcp' || provider === 'magnific_rest' || provider === 'comfyui') {
    return provider;
  }
  cpThrow(400, { error: 'invalid_provider' });
}

function bindWorkflowFromInputs(inputs: Record<string, unknown>) {
  return bindComfyWorkflow({
    workflow: objectValue(inputs.workflow) as Record<
      string,
      { class_type: string; inputs: Record<string, unknown> }
    >,
    bindings: objectValue(inputs.bindings) as Record<string, { nodeId: string; inputKey: string }>,
    values: objectValue(inputs.values),
  });
}

function isOomError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const rec = error as { error?: unknown; error_class?: unknown; message?: unknown };
  return rec.error === 'OUT_OF_MEMORY'
    || rec.error_class === 'OUT_OF_MEMORY'
    || /out of memory/i.test(String(rec.message ?? ''));
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableInteger(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}

function isPersistedAssetSyncFailure(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && (error as { error_class?: unknown }).error_class === 'ASSET_SYNC_FAILED'
    && (error as { persisted?: unknown }).persisted === true,
  );
}

function ingestFailReason(error: unknown): string {
  const reason = error && typeof error === 'object'
    ? String((error as { reason?: unknown }).reason ?? '').trim()
    : '';
  if (reason === 'wait_timeout' || reason === 'vendor_failed' || reason === 'storage_missing') {
    return reason;
  }
  return 'ingest_failed';
}

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'video/mp4') return 'mp4';
  if (mime === 'video/webm') return 'webm';
  if (mime === 'video/quicktime') return 'mov';
  return 'bin';
}
