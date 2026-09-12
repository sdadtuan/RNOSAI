import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CpJobsRepository } from './cp-jobs.repository';
import { CpJobsService, MagnificAdapterPort } from './cp-jobs.service';
import { CpLedgerService } from './cp-ledger.service';
import type { CpComfyAdapter } from './cp-comfy.adapter';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = '33333333-3333-4333-8333-333333333333';

class LedgerMemory {
  rows: Array<Record<string, unknown>> = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('SELECT * FROM crm_cp_credit_ledger')) {
      const existing = this.rows.find((row) => row.idempotency_key === params[1]);
      return { rows: existing ? [existing] : [] };
    }
    if (sql.includes('INSERT INTO crm_cp_credit_ledger')) {
      const key = String(params[7]);
      const existing = this.rows.find((row) => row.idempotency_key === key);
      if (existing) return { rows: [] };
      const row = {
        kind: params[1],
        amount: params[2],
        agency_client_id: params[3],
        project_id: params[4],
        job_id: params[5],
        idempotency_key: key,
        provider: params[8] ?? null,
      };
      this.rows.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

class JobsMemory {
  jobs: Array<Record<string, unknown>> = [];
  runs: Array<Record<string, unknown>> = [];
  project: Record<string, unknown> = {
    id: PROJECT_ID,
    agency_client_id: CLIENT_ID,
    cost_center: 'cp-pilot',
    classification: null,
    external_prohibited: false,
  };

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('FROM crm_cp_projects')) {
      return String(params[0]) === PROJECT_ID ? { rows: [{ ...this.project }] } : { rows: [] };
    }
    if (sql.includes('FROM crm_cp_render_jobs') && sql.includes('idempotency_key')) {
      const found = this.jobs.find((job) => job.idempotency_key === params[0]);
      return { rows: found ? [{ ...found }] : [] };
    }
    if (sql.includes('FROM crm_cp_render_jobs') && sql.includes('id =')) {
      const found = this.jobs.find((job) => job.id === params[0]);
      return { rows: found ? [{ ...found }] : [] };
    }
    if (sql.includes('INSERT INTO crm_cp_render_jobs')) {
      const key = String(params[6]);
      const existing = this.jobs.find((job) => job.idempotency_key === key);
      if (existing) return { rows: [] };
      const row = {
        id: JOB_ID,
        project_id: params[0],
        draft_id: null,
        task_id: params[1] ?? null,
        brand_kit_version_id: null,
        state: params[2],
        stage: params[2],
        progress: 0,
        provider: params[3],
        model: params[4] ?? null,
        idempotency_key: key,
        correlation_id: params[7],
        stage_log_json: typeof params[5] === 'string' ? JSON.parse(String(params[5])) : params[5],
        attempt: 1,
      };
      this.jobs.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE crm_cp_render_jobs')) {
      const job = this.jobs.find((item) => item.id === params[params.length - 1]);
      if (!job) return { rows: [] };
      if (sql.includes("state = 'queued'") && job.state !== 'queued') {
        return { rows: [] };
      }
      if (sql.includes('SET state =')) job.state = String(params[0]);
      if (sql.includes('stage = $2') || sql.includes("stage = 'magnific_wait'")) {
        job.stage = String(params[1] ?? 'magnific_wait');
      }
      if (sql.includes('error_class')) {
        job.error_class = params[sql.includes('SET state') ? 1 : 0];
      }
      const raw = params.find((value) =>
        typeof value === 'string' && (value.startsWith('{') || value.startsWith('[')),
      );
      if (raw) job.stage_log_json = JSON.parse(String(raw));
      return { rows: [{ ...job }] };
    }
    if (sql.includes('INSERT INTO crm_cp_provider_runs')) {
      const run = {
        id: 'run-1',
        job_id: params[0],
        provider: params[2],
        mode: params[3],
        external_run_id: params[4],
        status: params[7],
      };
      this.runs.push(run);
      return { rows: [run] };
    }
    return { rows: [] };
  }
}

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    project_id: PROJECT_ID,
    provider: 'magnific_mcp' as const,
    inputs: { capability: 'images_generate', estimated_credits: 12 },
    idempotency_key: 'job-k1',
    ...overrides,
  };
}

function comfyDraftInput(overrides: Record<string, unknown> = {}) {
  return {
    project_id: PROJECT_ID,
    provider: 'comfyui' as const,
    inputs: {
      estimated_credits: 12,
      workflow: {
        '20': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'default packshot prompt', clip: ['19', 0] },
        },
        '19': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'model.safetensors' },
        },
      },
      bindings: { positivePrompt: { nodeId: '20', inputKey: 'text' } },
      values: { positivePrompt: 'luxury watch on marble' },
    },
    idempotency_key: 'job-comfy-1',
    ...overrides,
  };
}

function makeComfyAdapter(overrides: Partial<CpComfyAdapter> = {}): CpComfyAdapter {
  return {
    systemStats: jest.fn(async () => ({ ok: true, vram_mb: 24576 })),
    prompt: jest.fn(async () => ({ promptId: 'prm-1' })),
    history: jest.fn(async () => ({ outputFiles: ['ComfyUI_00001_.png'] })),
    interrupt: jest.fn(async () => undefined),
    download: jest.fn(async () => ({ bytes: Buffer.from('comfy-png'), mime: 'image/png' })),
    providerHealth: jest.fn(async () => ({
      comfy: { ok: true, vram_mb: 24576, checked_at: '2026-09-13T03:00:00.000Z' },
    })),
    ...overrides,
  } as unknown as CpComfyAdapter;
}

function makeService(opts?: {
  db?: JobsMemory;
  ledgerDb?: LedgerMemory;
  adapter?: Partial<MagnificAdapterPort>;
  comfy?: Partial<CpComfyAdapter> | CpComfyAdapter;
  settings?: { high_cost_threshold?: number | null; magnific_video_wait_sec?: number | null };
  assets?: {
    createAsset: jest.Mock;
    replaceFile: jest.Mock;
    finalizeIngest: jest.Mock;
  };
}) {
  const db = opts?.db ?? new JobsMemory();
  const ledgerDb = opts?.ledgerDb ?? new LedgerMemory();
  const adapter: MagnificAdapterPort = {
    getBalance: jest.fn(async () => ({ credits: 99 })),
    generate: jest.fn(async () => ({ externalRunId: 'ext-1' })),
    wait: jest.fn(async () => ({ outputUrls: [], actualCredits: null })),
    download: jest.fn(async () => ({ bytes: Buffer.from('x'), mime: 'image/png' })),
    ...opts?.adapter,
  };
  const settings = {
    get: jest.fn(async () => ({
      high_cost_threshold: opts?.settings?.high_cost_threshold ?? 200,
      magnific_video_wait_sec: opts?.settings?.magnific_video_wait_sec ?? null,
    })),
  };
  const assets = opts?.assets ?? {
    createAsset: jest.fn(async () => ({ id: '44444444-4444-4444-8444-444444444444' })),
    replaceFile: jest.fn(async () => ({ id: 'ver-1' })),
    finalizeIngest: jest.fn(async () => ({
      id: '44444444-4444-4444-8444-444444444444',
      hash: 'abc',
      state: 'ready',
    })),
  };
  const comfy = opts?.comfy && 'systemStats' in opts.comfy
    ? opts.comfy as CpComfyAdapter
    : makeComfyAdapter(opts?.comfy);
  const repo = new CpJobsRepository(db);
  const ledger = new CpLedgerService(ledgerDb);
  const service = new CpJobsService(repo, ledger, adapter, settings as never, assets as never, comfy);
  return { service, db, ledgerDb, adapter, comfy, settings, assets };
}

describe('CpJobsService', () => {
  const envBackup = process.env;

  beforeEach(() => {
    process.env = {
      ...envBackup,
      MAGNIFIC_MCP_ENABLED: '1',
      MAGNIFIC_REST_API_ENABLED: '1',
    };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('rejects a missing project_id with 422 GT-A01', async () => {
    const { service } = makeService();
    await expect(
      service.draft(9, draftInput({ project_id: '' })),
    ).rejects.toMatchObject({
      status: 422,
      error: 'project_id_required',
      gate: 'GT-A01',
    });
  });

  it('rejects confirm !== true with 400 human_confirm_required', async () => {
    const { service } = makeService();
    const drafted = await service.draft(9, draftInput());
    await expect(
      service.confirm(9, drafted.job_id, { confirm: false }),
    ).rejects.toMatchObject({
      status: 400,
      error: 'human_confirm_required',
    });
  });

  it('rejects a disabled provider flag with GT-A03', async () => {
    process.env.MAGNIFIC_MCP_ENABLED = '0';
    const { service } = makeService();
    await expect(service.draft(9, draftInput())).rejects.toMatchObject({
      gate: 'GT-A03',
    });
    await expect(service.draft(9, draftInput())).rejects.toMatchObject({
      status: expect.anything(),
    });
  });

  it('rejects RESTRICTED and externalProhibited with 409 GT-M05', async () => {
    const restricted = new JobsMemory();
    restricted.project.classification = 'RESTRICTED';
    await expect(
      makeService({ db: restricted }).service.draft(9, draftInput()),
    ).rejects.toMatchObject({ status: 409, gate: 'GT-M05' });

    const blocked = new JobsMemory();
    blocked.project.external_prohibited = true;
    await expect(
      makeService({ db: blocked }).service.draft(9, draftInput({ idempotency_key: 'job-k2' })),
    ).rejects.toMatchObject({ status: 409, gate: 'GT-M05' });
  });

  it('returns the same job_id for the same idempotency_key (GT-A10)', async () => {
    const { service, db } = makeService();
    const first = await service.draft(9, draftInput());
    const second = await service.draft(9, draftInput());
    expect(first.job_id).toBe(second.job_id);
    expect(db.jobs).toHaveLength(1);
  });

  it('reserves credits on confirm with the Magnific provider', async () => {
    const { service, ledgerDb } = makeService();
    const drafted = await service.draft(9, draftInput());
    expect(drafted.requires_confirmation).toBe(true);
    expect(drafted.status).toBe('pending_confirm');

    await service.confirm(9, drafted.job_id, { confirm: true });

    const reserve = ledgerDb.rows.find((row) => row.kind === 'reserve');
    expect(reserve).toMatchObject({
      amount: 12,
      provider: 'magnific_mcp',
      job_id: drafted.job_id,
    });
  });

  it('releases the reserved amount with rel:{idempotency} when submit fails', async () => {
    const generate = jest.fn(async () => {
      throw Object.assign(new Error('provider_down'), { status: 502 });
    });
    const { service, ledgerDb } = makeService({ adapter: { generate } });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-fail' }));
    await service.confirm(9, drafted.job_id, { confirm: true });

    await expect(service.submit(9, drafted.job_id)).rejects.toBeTruthy();

    const release = ledgerDb.rows.find((row) => row.kind === 'release');
    expect(release).toMatchObject({
      amount: 12,
      provider: 'magnific_mcp',
      idempotency_key: 'rel:job-fail',
    });
  });

  it('requires crm_cp.render_high_cost when estimate exceeds the threshold', async () => {
    const { service } = makeService({ settings: { high_cost_threshold: 200 } });
    await expect(
      service.draft(
        9,
        draftInput({
          idempotency_key: 'job-high',
          inputs: { capability: 'video_generate', estimated_credits: 250 },
        }),
        { hasHighCostCap: false },
      ),
    ).rejects.toMatchObject({
      status: 403,
      error: 'missing_cap',
      section: 'crm_cp.render_high_cost',
    });
  });

  it('records a queued provider run and calls the adapter port on submit', async () => {
    const { service, db, adapter } = makeService();
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-sub' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    const submitted = await service.submit(9, drafted.job_id);

    expect(adapter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: 'mcp',
        capability: 'images_generate',
      }),
    );
    expect(db.runs[0]).toMatchObject({
      job_id: drafted.job_id,
      provider: 'magnific_mcp',
      status: 'queued',
      external_run_id: 'ext-1',
    });
    expect(submitted).toMatchObject({ job_id: drafted.job_id });
  });

  it('rejects submit after cancel with 409 even if confirmed stays set', async () => {
    const { service, adapter } = makeService();
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-cancel' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.cancel(9, drafted.job_id);

    await expect(service.submit(9, drafted.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'job_not_submittable',
    });
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('re-reserves on retry after submit fail using reserve:{idempotency}:{attempt}', async () => {
    const generate = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('provider_down'), { status: 502 }))
      .mockResolvedValueOnce({ externalRunId: 'ext-retry' });
    const { service, ledgerDb } = makeService({
      adapter: { generate },
    });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-retry' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await expect(service.submit(9, drafted.job_id)).rejects.toBeTruthy();

    expect(ledgerDb.rows.filter((row) => row.kind === 'reserve')).toHaveLength(1);
    expect(ledgerDb.rows.filter((row) => row.kind === 'release')).toHaveLength(1);

    const retried = await service.retry(9, drafted.job_id);

    expect(retried).toMatchObject({ job_id: drafted.job_id, status: 'queued' });
    const reserves = ledgerDb.rows.filter((row) => row.kind === 'reserve');
    expect(reserves).toHaveLength(2);
    expect(reserves[1]).toMatchObject({
      amount: 12,
      provider: 'magnific_mcp',
      idempotency_key: 'reserve:job-retry:2',
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('rejects confirm after cancel with 409 job_not_confirmable', async () => {
    const { service, ledgerDb } = makeService();
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-reconfirm-cancel' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.cancel(9, drafted.job_id);

    await expect(service.confirm(9, drafted.job_id, { confirm: true })).rejects.toMatchObject({
      status: 409,
      error: 'job_not_confirmable',
    });
    expect(ledgerDb.rows.filter((row) => row.kind === 'reserve')).toHaveLength(1);
  });

  it('rejects confirm after queued with 409 job_not_confirmable', async () => {
    const { service, ledgerDb } = makeService();
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-reconfirm-queued' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    await expect(service.confirm(9, drafted.job_id, { confirm: true })).rejects.toMatchObject({
      status: 409,
      error: 'job_not_confirmable',
    });
    expect(ledgerDb.rows.filter((row) => row.kind === 'reserve')).toHaveLength(1);
  });

  it('blocks confirm when the durable GT-M05 snapshot is RESTRICTED', async () => {
    const { service, db } = makeService();
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-snap' }));
    expect(db.jobs[0]?.stage_log_json).toMatchObject({
      classification: null,
      external_prohibited: false,
    });

    const log = db.jobs[0].stage_log_json as Record<string, unknown>;
    log.classification = 'RESTRICTED';
    db.jobs[0].stage_log_json = log;

    await expect(service.confirm(9, drafted.job_id, { confirm: true })).rejects.toMatchObject({
      status: 409,
      gate: 'GT-M05',
    });
  });

  it('does not submit when getBalance() returns null credits (GT-M02)', async () => {
    const { service, adapter, db } = makeService({
      adapter: { getBalance: jest.fn(async () => ({ credits: null })) },
    });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-bal' }));
    await service.confirm(9, drafted.job_id, { confirm: true });

    await expect(service.submit(9, drafted.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'POLICY_BLOCKED',
      gate: 'GT-M02',
    });
    expect(adapter.generate).not.toHaveBeenCalled();
    expect(db.runs).toHaveLength(0);
    expect(db.jobs[0]?.state).toBe('pending_confirm');
  });

  it('does not submit when credits are below estimate, including 0 (GT-M02)', async () => {
    const low = makeService({
      adapter: { getBalance: jest.fn(async () => ({ credits: 0 })) },
    });
    const draftedLow = await low.service.draft(9, draftInput({ idempotency_key: 'job-bal-0' }));
    await low.service.confirm(9, draftedLow.job_id, { confirm: true });
    await expect(low.service.submit(9, draftedLow.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'POLICY_BLOCKED',
      gate: 'GT-M02',
    });
    expect(low.adapter.generate).not.toHaveBeenCalled();
    expect(low.db.runs).toHaveLength(0);

    const short = makeService({
      adapter: { getBalance: jest.fn(async () => ({ credits: 11 })) },
    });
    const draftedShort = await short.service.draft(9, draftInput({ idempotency_key: 'job-bal-short' }));
    await short.service.confirm(9, draftedShort.job_id, { confirm: true });
    await expect(short.service.submit(9, draftedShort.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'POLICY_BLOCKED',
      gate: 'GT-M02',
    });
    expect(short.adapter.generate).not.toHaveBeenCalled();
  });

  it('fails ingest with ASSET_SYNC_FAILED when wait resolves with empty URLs', async () => {
    const { service, db } = makeService({
      adapter: {
        wait: jest.fn(async () => ({ outputUrls: [], actualCredits: null })),
      },
    });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-empty-wait' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    await expect(service.ingest(9, drafted.job_id)).rejects.toMatchObject({
      error_class: 'ASSET_SYNC_FAILED',
      reason: 'missing_output_url',
    });
    expect(db.jobs[0]).toMatchObject({
      state: 'failed',
      error_class: 'ASSET_SYNC_FAILED',
    });
  });

  it('lets only one overlapping ingest download and createAsset', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cp-magnific-claim-'));
    process.env.CP_ASSET_STORAGE = root;
    let releaseWait: (() => void) | undefined;
    const waitGate = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    const wait = jest.fn(async () => {
      await waitGate;
      return { outputUrls: ['https://cdn.example/out.png'], actualCredits: 1 };
    });
    const download = jest.fn(async () => ({ bytes: Buffer.from('png-once'), mime: 'image/png' }));
    const { service, assets } = makeService({ adapter: { wait, download } });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-claim' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    const first = service.ingest(9, drafted.job_id);
    const second = service.ingest(9, drafted.job_id);
    releaseWait?.();
    const results = await Promise.all([first, second]);

    expect(download).toHaveBeenCalledTimes(1);
    expect(assets.createAsset).toHaveBeenCalledTimes(1);
    expect(results.filter((row) => row && (row as { state?: string }).state === 'qc')).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });

  it('fails ingest with ASSET_SYNC_FAILED when download has no checksum (GT-M06)', async () => {
    const { service, db, ledgerDb } = makeService({
      adapter: {
        wait: jest.fn(async () => ({ outputUrls: ['https://cdn.example/out.png'], actualCredits: 2 })),
        download: jest.fn(async () => ({ bytes: Buffer.alloc(0), mime: 'image/png' })),
      },
    });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-sync' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    await expect(service.ingest(9, drafted.job_id)).rejects.toMatchObject({
      error_class: 'ASSET_SYNC_FAILED',
    });
    expect(db.jobs[0]).toMatchObject({
      state: 'failed',
      error_class: 'ASSET_SYNC_FAILED',
    });
    expect(String(db.jobs[0]?.state)).not.toBe('completed');
    expect(ledgerDb.rows.filter((row) => row.kind === 'charge')).toHaveLength(0);
  });

  it('copies bytes into DAM with provenance provider, external_run_id, tool, checksum', async () => {
    const bytes = Buffer.from('png-master-bytes');
    const root = mkdtempSync(join(tmpdir(), 'cp-magnific-dam-'));
    process.env.CP_ASSET_STORAGE = root;
    const { service, db, assets } = makeService({
      adapter: {
        wait: jest.fn(async () => ({ outputUrls: ['https://cdn.example/out.png'], actualCredits: 3 })),
        download: jest.fn(async () => ({ bytes, mime: 'image/png' })),
      },
    });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-ing' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    const ingested = await service.ingest(9, drafted.job_id);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const dest = join(root, 'magnific', drafted.job_id, `${checksum}.png`);

    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest).equals(bytes)).toBe(true);
    expect(assets.createAsset).toHaveBeenCalled();
    expect(assets.replaceFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        hash: checksum,
        bytes: bytes.length,
        mime: 'image/png',
        storage_key: `magnific/${drafted.job_id}/${checksum}.png`,
        meta_json: expect.objectContaining({
          provenance: {
            provider: 'magnific_mcp',
            external_run_id: 'ext-1',
            tool: 'images_generate',
            checksum,
          },
        }),
      }),
      expect.any(Object),
    );
    expect(assets.finalizeIngest).toHaveBeenCalledWith(
      expect.any(String),
      { bytes: bytes.length, hash: checksum },
      expect.any(Object),
    );
    expect(ingested).toMatchObject({
      job_id: drafted.job_id,
      state: 'qc',
    });
    expect(db.jobs[0]?.state).toBe('qc');
    const log = db.jobs[0]?.stage_log_json as Record<string, unknown>;
    expect(log.width === 0 || log.duration_sec === 0).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  it('charges actual credits after DAM+qc and uses reserved when actual is null', async () => {
    const bytes = Buffer.from('png-charge-bytes');
    const root = mkdtempSync(join(tmpdir(), 'cp-magnific-chg-'));
    process.env.CP_ASSET_STORAGE = root;
    const actual = makeService({
      adapter: {
        wait: jest.fn(async () => ({ outputUrls: ['https://cdn.example/out.png'], actualCredits: 3 })),
        download: jest.fn(async () => ({ bytes, mime: 'image/png' })),
      },
    });
    const drafted = await actual.service.draft(9, draftInput({ idempotency_key: 'job-chg' }));
    await actual.service.confirm(9, drafted.job_id, { confirm: true });
    await actual.service.submit(9, drafted.job_id);
    await actual.service.ingest(9, drafted.job_id);
    expect(actual.ledgerDb.rows.find((row) => row.kind === 'charge')).toMatchObject({
      amount: 3,
      provider: 'magnific_mcp',
      idempotency_key: 'chg:job-chg:1',
    });
    rmSync(root, { recursive: true, force: true });

    const reservedRoot = mkdtempSync(join(tmpdir(), 'cp-magnific-chg-res-'));
    process.env.CP_ASSET_STORAGE = reservedRoot;
    const reserved = makeService({
      adapter: {
        wait: jest.fn(async () => ({ outputUrls: ['https://cdn.example/out.png'], actualCredits: null })),
        download: jest.fn(async () => ({ bytes, mime: 'image/png' })),
      },
    });
    const draftedRes = await reserved.service.draft(9, draftInput({ idempotency_key: 'job-chg-res' }));
    await reserved.service.confirm(9, draftedRes.job_id, { confirm: true });
    await reserved.service.submit(9, draftedRes.job_id);
    await reserved.service.ingest(9, draftedRes.job_id);
    expect(reserved.ledgerDb.rows.find((row) => row.kind === 'charge')).toMatchObject({
      amount: 12,
      provider: 'magnific_mcp',
      idempotency_key: 'chg:job-chg-res:1',
    });
    rmSync(reservedRoot, { recursive: true, force: true });
  });

  it('fails ingest with storage_missing when asset storage env is unset', async () => {
    delete process.env.CP_ASSET_STORAGE;
    delete process.env.MAGNIFIC_ASSET_PREFIX;
    const bytes = Buffer.from('png-no-disk');
    const { service, db, assets } = makeService({
      adapter: {
        wait: jest.fn(async () => ({ outputUrls: ['https://cdn.example/out.png'], actualCredits: 1 })),
        download: jest.fn(async () => ({ bytes, mime: 'image/png' })),
      },
    });
    const drafted = await service.draft(9, draftInput({ idempotency_key: 'job-nodisk' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    await expect(service.ingest(9, drafted.job_id)).rejects.toMatchObject({
      error_class: 'ASSET_SYNC_FAILED',
      reason: 'storage_missing',
    });
    expect(db.jobs[0]).toMatchObject({
      state: 'failed',
      error_class: 'ASSET_SYNC_FAILED',
    });
    expect(db.jobs[0]?.state).not.toBe('qc');
    expect(db.jobs[0]?.state).not.toBe('completed');
    expect(assets.replaceFile).not.toHaveBeenCalled();
  });

  it('does not inject jobs submit into the AI gateway generate-brief path', () => {
    const weave = readFileSync(join(__dirname, 'cp-weave.service.ts'), 'utf8');
    const controller = readFileSync(join(__dirname, 'cp.controller.ts'), 'utf8');
    expect(weave).not.toMatch(/CpJobsService/);
    expect(controller).toMatch(/generateWeaveBrief[\s\S]{0,180}this\.weave\.generateBrief/);
    expect(controller).not.toMatch(/generateWeaveBrief[\s\S]{0,180}this\.jobs/);
  });

  it('drafts and confirms a comfyui job with the same confirm gate', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const { service, db } = makeService();
    const drafted = await service.draft(9, comfyDraftInput());
    expect(drafted.status).toBe('pending_confirm');
    expect(db.jobs[0]?.provider).toBe('comfyui');

    await expect(
      service.confirm(9, drafted.job_id, { confirm: false }),
    ).rejects.toMatchObject({
      status: 400,
      error: 'human_confirm_required',
    });

    await service.confirm(9, drafted.job_id, { confirm: true });
    expect(db.jobs[0]?.state).toBe('pending_confirm');
  });

  it('returns 409 WORKER_UNAVAILABLE on comfy submit when the flag is off and does not call the adapter', async () => {
    delete process.env.COMFYUI_WORKER_ENABLED;
    const prompt = jest.fn(async () => ({ promptId: 'prm-1' }));
    const systemStats = jest.fn(async () => ({ ok: true, vram_mb: 24576 }));
    const { service, db } = makeService({ comfy: { prompt, systemStats } });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-off' }));
    await service.confirm(9, drafted.job_id, { confirm: true });

    await expect(service.submit(9, drafted.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'WORKER_UNAVAILABLE',
      gate: 'GT-C01',
    });
    expect(prompt).not.toHaveBeenCalled();
    expect(systemStats).not.toHaveBeenCalled();
    expect(db.runs).toHaveLength(0);
    expect(db.jobs[0]?.state).toBe('pending_confirm');
  });

  it('returns 409 WORKER_UNAVAILABLE when heartbeat fails and does not prompt', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const prompt = jest.fn(async () => ({ promptId: 'prm-1' }));
    const systemStats = jest.fn(async () => ({ ok: false, vram_mb: null }));
    const { service } = makeService({ comfy: { prompt, systemStats } });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-hb' }));
    await service.confirm(9, drafted.job_id, { confirm: true });

    await expect(service.submit(9, drafted.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'WORKER_UNAVAILABLE',
      gate: 'GT-C01',
    });
    expect(prompt).not.toHaveBeenCalled();
  });

  it('submits a comfyui job through bind+prompt and records the provider run', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const prompt = jest.fn(async (_jobId: string, bound: Record<string, { inputs: Record<string, unknown> }>) => {
      expect(bound['20'].inputs.text).toBe('luxury watch on marble');
      return { promptId: 'prm-1' };
    });
    const { service, db, comfy } = makeService({ comfy: { prompt } });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-sub' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    const submitted = await service.submit(9, drafted.job_id);

    expect(comfy.prompt).toHaveBeenCalledWith(drafted.job_id, expect.any(Object));
    expect(db.runs[0]).toMatchObject({
      job_id: drafted.job_id,
      provider: 'comfyui',
      status: 'queued',
      external_run_id: 'prm-1',
    });
    expect(submitted).toMatchObject({
      job_id: drafted.job_id,
      status: 'queued',
      external_run_id: 'prm-1',
    });
    expect(comfy.systemStats).toHaveBeenCalled();
  });

  it('fails comfy ingest with ASSET_SYNC_FAILED when download has no checksum (GT-C04)', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const { service, db } = makeService({
      comfy: {
        history: jest.fn(async () => ({ outputFiles: ['ComfyUI_00001_.png'] })),
        download: jest.fn(async () => ({ bytes: Buffer.alloc(0), mime: 'image/png' })),
      },
    });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-sync' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    await expect(service.ingest(9, drafted.job_id)).rejects.toMatchObject({
      error_class: 'ASSET_SYNC_FAILED',
    });
    expect(db.jobs[0]).toMatchObject({
      state: 'failed',
      error_class: 'ASSET_SYNC_FAILED',
    });
    expect(String(db.jobs[0]?.state)).not.toBe('completed');
  });

  it('ingests comfy output into DAM with checksum and never stores width/duration as 0', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const bytes = Buffer.from('comfy-master-bytes');
    const root = mkdtempSync(join(tmpdir(), 'cp-comfy-dam-'));
    process.env.CP_ASSET_STORAGE = root;
    const { service, db, assets } = makeService({
      comfy: {
        history: jest.fn(async () => ({ outputFiles: ['ComfyUI_00001_.png'] })),
        download: jest.fn(async () => ({ bytes, mime: 'image/png' })),
      },
    });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-ing' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    const ingested = await service.ingest(9, drafted.job_id);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const dest = join(root, 'comfyui', drafted.job_id, `${checksum}.png`);

    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest).equals(bytes)).toBe(true);
    expect(assets.replaceFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        hash: checksum,
        storage_key: `comfyui/${drafted.job_id}/${checksum}.png`,
        meta_json: expect.objectContaining({
          provenance: expect.objectContaining({
            provider: 'comfyui',
            external_run_id: 'prm-1',
            checksum,
          }),
        }),
      }),
      expect.any(Object),
    );
    expect(ingested).toMatchObject({
      job_id: drafted.job_id,
      state: 'qc',
    });
    const log = db.jobs[0]?.stage_log_json as Record<string, unknown>;
    expect(log.width === 0 || log.duration_sec === 0).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  it('ingests comfy output after the first history snapshot is empty', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    process.env.COMFY_WAIT_MS = '80';
    process.env.COMFY_POLL_MS = '5';
    const bytes = Buffer.from('comfy-poll-bytes');
    const root = mkdtempSync(join(tmpdir(), 'cp-comfy-poll-'));
    process.env.CP_ASSET_STORAGE = root;
    const history = jest.fn()
      .mockResolvedValueOnce({ outputFiles: [] })
      .mockResolvedValueOnce({ outputFiles: ['ComfyUI_00001_.png'] });
    const { service, db } = makeService({
      comfy: {
        history,
        download: jest.fn(async () => ({ bytes, mime: 'image/png' })),
      },
    });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-hist-poll' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    const ingested = await service.ingest(9, drafted.job_id);

    expect(history.mock.calls.length).toBeGreaterThan(1);
    expect(ingested).toMatchObject({
      job_id: drafted.job_id,
      state: 'qc',
    });
    expect(db.jobs[0]?.error_class).not.toBe('ASSET_SYNC_FAILED');
    expect(db.jobs[0]?.state).not.toBe('failed');
    rmSync(root, { recursive: true, force: true });
  });

  it('does not mark ASSET_SYNC_FAILED missing_output_url on the first empty comfy history snapshot', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    process.env.COMFY_WAIT_MS = '40';
    process.env.COMFY_POLL_MS = '5';
    const history = jest.fn(async () => ({ outputFiles: [] }));
    const { service, db } = makeService({ comfy: { history } });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-hist-empty' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    await expect(service.ingest(9, drafted.job_id)).rejects.toMatchObject({
      error_class: 'ASSET_SYNC_FAILED',
      reason: 'wait_timeout',
    });
    expect(history.mock.calls.length).toBeGreaterThan(1);
    expect(db.jobs[0]).toMatchObject({
      state: 'failed',
      error_class: 'ASSET_SYNC_FAILED',
    });
    const log = db.jobs[0]?.stage_log_json as Record<string, unknown>;
    expect(log.sync_fail_reason).toBe('wait_timeout');
    expect(log.sync_fail_reason).not.toBe('missing_output_url');
  });

  it('retries history OOM once with a second prompt then persists OUT_OF_MEMORY', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const oom = Object.assign(new Error('OUT_OF_MEMORY'), {
      status: 409,
      error: 'OUT_OF_MEMORY',
    });
    const prompt = jest.fn()
      .mockResolvedValueOnce({ promptId: 'prm-1' })
      .mockResolvedValueOnce({ promptId: 'prm-2' });
    const history = jest.fn().mockRejectedValue(oom);
    const { service, db, ledgerDb } = makeService({ comfy: { prompt, history } });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-hist-oom' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    await expect(service.ingest(9, drafted.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'OUT_OF_MEMORY',
    });
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(history).toHaveBeenCalledTimes(2);
    expect(db.jobs[0]).toMatchObject({
      state: 'failed',
      error_class: 'OUT_OF_MEMORY',
    });
    const reserves = ledgerDb.rows.filter((row) => row.kind === 'reserve');
    expect(reserves.some((row) => row.idempotency_key === 'reserve:job-comfy-hist-oom:2')).toBe(true);
  });

  it('retries history OOM once then ingests the second execution', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const oom = Object.assign(new Error('OUT_OF_MEMORY'), {
      status: 409,
      error: 'OUT_OF_MEMORY',
    });
    const bytes = Buffer.from('comfy-oom-retry-bytes');
    const root = mkdtempSync(join(tmpdir(), 'cp-comfy-oom-'));
    process.env.CP_ASSET_STORAGE = root;
    const prompt = jest.fn()
      .mockResolvedValueOnce({ promptId: 'prm-1' })
      .mockResolvedValueOnce({ promptId: 'prm-2' });
    const history = jest.fn()
      .mockRejectedValueOnce(oom)
      .mockResolvedValueOnce({ outputFiles: ['ComfyUI_00002_.png'] });
    const { service, db, ledgerDb } = makeService({
      comfy: {
        prompt,
        history,
        download: jest.fn(async () => ({ bytes, mime: 'image/png' })),
      },
    });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-hist-oom-ok' }));
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);

    const ingested = await service.ingest(9, drafted.job_id);

    expect(prompt).toHaveBeenCalledTimes(2);
    expect(history).toHaveBeenCalledWith('prm-1');
    expect(history).toHaveBeenCalledWith('prm-2');
    expect(ingested).toMatchObject({
      job_id: drafted.job_id,
      state: 'qc',
    });
    expect(db.jobs[0]?.error_class).not.toBe('OUT_OF_MEMORY');
    const reserves = ledgerDb.rows.filter((row) => row.kind === 'reserve');
    expect(reserves.some((row) => row.idempotency_key === 'reserve:job-comfy-hist-oom-ok:2')).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it('retries OOM once with attempt+1 then persists OUT_OF_MEMORY', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const oom = Object.assign(new Error('OUT_OF_MEMORY'), {
      status: 409,
      error: 'OUT_OF_MEMORY',
    });
    const prompt = jest.fn()
      .mockRejectedValueOnce(oom)
      .mockRejectedValueOnce(oom);
    const { service, db, ledgerDb } = makeService({ comfy: { prompt } });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-oom' }));
    await service.confirm(9, drafted.job_id, { confirm: true });

    await expect(service.submit(9, drafted.job_id)).rejects.toMatchObject({
      status: 409,
      error: 'OUT_OF_MEMORY',
    });
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(db.jobs[0]).toMatchObject({
      state: 'failed',
      error_class: 'OUT_OF_MEMORY',
    });
    const reserves = ledgerDb.rows.filter((row) => row.kind === 'reserve');
    expect(reserves.some((row) => row.idempotency_key === 'reserve:job-comfy-oom:2')).toBe(true);
  });

  it('allows a RESTRICTED project to draft comfyui', async () => {
    process.env.COMFYUI_WORKER_ENABLED = '1';
    const restricted = new JobsMemory();
    restricted.project.classification = 'RESTRICTED';
    const { service } = makeService({ db: restricted });
    const drafted = await service.draft(9, comfyDraftInput({ idempotency_key: 'job-comfy-restricted' }));
    expect(drafted.job_id).toBe(JOB_ID);
  });
});
