import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { CpJobsRepository } from './cp-jobs.repository';
import { CpLedgerService } from './cp-ledger.service';
import { assertMagnificAllowed } from './cp-magnific-policy.util';
import { CpSettingsService } from './cp-settings.service';

export const MAGNIFIC_ADAPTER = 'MAGNIFIC_ADAPTER';

export type CpJobDraftInput = {
  project_id: string;
  task_id?: string;
  template_id?: string;
  provider: 'magnific_mcp' | 'magnific_rest';
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
  getBalance(): Promise<{ credits: number | null }>;
  generate(input: {
    transport: 'mcp' | 'rest';
    capability: string;
    inputs: Record<string, unknown>;
  }): Promise<{ externalRunId: string }>;
  wait(externalRunId: string): Promise<{ outputUrls: string[]; actualCredits: number | null }>;
  download(url: string): Promise<{ bytes: Buffer; mime: string }>;
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

    const inputs = objectValue(log.inputs);
    const capability = String(inputs.capability ?? job.model ?? 'images_generate');
    const transport = provider === 'magnific_rest' ? 'rest' : 'mcp';
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
    await this.releaseCredits(
      job,
      log,
      requiredProvider(job.provider),
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
    provider: 'magnific_mcp' | 'magnific_rest',
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
    provider: 'magnific_mcp' | 'magnific_rest',
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
    provider: 'magnific_mcp' | 'magnific_rest',
    project: Record<string, unknown>,
    inputs: Record<string, unknown>,
  ): void {
    assertMagnificAllowed({
      provider,
      flags: readAiOpsFlags(),
      classification: policyClassification(project, inputs),
      externalProhibited: policyExternalProhibited(project, inputs),
    });
  }

  private async assertDurablePolicy(
    provider: 'magnific_mcp' | 'magnific_rest',
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

function requiredProvider(value: unknown): 'magnific_mcp' | 'magnific_rest' {
  const provider = String(value ?? '').trim();
  if (provider === 'magnific_mcp' || provider === 'magnific_rest') return provider;
  cpThrow(400, { error: 'invalid_provider' });
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
