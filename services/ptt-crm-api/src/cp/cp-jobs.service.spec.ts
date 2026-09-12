import { readFileSync } from 'fs';
import { join } from 'path';
import { CpJobsRepository } from './cp-jobs.repository';
import { CpJobsService, MagnificAdapterPort } from './cp-jobs.service';
import { CpLedgerService } from './cp-ledger.service';

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
      if (sql.includes('SET state =')) job.state = String(params[0]);
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

function makeService(opts?: {
  db?: JobsMemory;
  ledgerDb?: LedgerMemory;
  adapter?: Partial<MagnificAdapterPort>;
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
  const repo = new CpJobsRepository(db);
  const ledger = new CpLedgerService(ledgerDb);
  const service = new CpJobsService(repo, ledger, adapter, settings as never, assets as never);
  return { service, db, ledgerDb, adapter, settings, assets };
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

  it('fails ingest with ASSET_SYNC_FAILED when download has no checksum (GT-M06)', async () => {
    const { service, db } = makeService({
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
  });

  it('copies bytes into DAM with provenance provider, external_run_id, tool, checksum', async () => {
    const bytes = Buffer.from('png-master-bytes');
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
    const checksum = require('crypto').createHash('sha256').update(bytes).digest('hex');

    expect(assets.createAsset).toHaveBeenCalled();
    expect(assets.replaceFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        hash: checksum,
        bytes: bytes.length,
        mime: 'image/png',
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
      state: 'quality_check',
    });
    expect(db.jobs[0]?.state).toBe('quality_check');
    const log = db.jobs[0]?.stage_log_json as Record<string, unknown>;
    expect(log.width === 0 || log.duration_sec === 0).toBe(false);
  });

  it('does not inject jobs submit into the AI gateway generate-brief path', () => {
    const weave = readFileSync(join(__dirname, 'cp-weave.service.ts'), 'utf8');
    const controller = readFileSync(join(__dirname, 'cp.controller.ts'), 'utf8');
    expect(weave).not.toMatch(/CpJobsService/);
    expect(controller).toMatch(/generateWeaveBrief[\s\S]{0,180}this\.weave\.generateBrief/);
    expect(controller).not.toMatch(/generateWeaveBrief[\s\S]{0,180}this\.jobs/);
  });
});
