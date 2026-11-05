import { createHash } from 'crypto';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CpJobsRepository } from './cp-jobs.repository';
import { CpJobsService, MagnificAdapterPort } from './cp-jobs.service';
import { CpLedgerService } from './cp-ledger.service';
import type { CpMagnificFlowsAdapter } from './cp-magnific-flows.adapter';
import type { CpMagnificFlowTemplatesService } from './cp-magnific-flow-templates.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = '33333333-3333-4333-8333-333333333333';
const TEMPLATE_ID = '55555555-5555-4555-8555-555555555555';
const FLOW_SQID = 'uqzQLDr2Aw';

class LedgerMemory {
  rows: Array<Record<string, unknown>> = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('SELECT * FROM crm_cp_credit_ledger')) {
      const existing = this.rows.find((row) => row.idempotency_key === params[1]);
      return { rows: existing ? [existing] : [] };
    }
    if (sql.includes('INSERT INTO crm_cp_credit_ledger')) {
      const key = String(params[7]);
      if (this.rows.some((row) => row.idempotency_key === key)) return { rows: [] };
      const row = {
        kind: params[1],
        amount: params[2],
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
  project = {
    id: PROJECT_ID,
    agency_client_id: CLIENT_ID,
    cost_center: 'cp-pilot',
    classification: null,
    external_prohibited: false,
  };

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('FROM crm_cp_projects')) {
      return { rows: [{ ...this.project }] };
    }
    if (sql.includes('INSERT INTO crm_cp_render_jobs')) {
      const row = {
        id: JOB_ID,
        project_id: params[0],
        state: params[2],
        provider: params[3],
        model: params[4] ?? null,
        idempotency_key: params[6],
        stage_log_json: typeof params[5] === 'string' ? JSON.parse(String(params[5])) : params[5],
      };
      if (this.jobs.some((job) => job.idempotency_key === params[6])) return { rows: [] };
      this.jobs.push(row);
      return { rows: [row] };
    }
    if (sql.includes('FROM crm_cp_render_jobs') && sql.includes('idempotency_key')) {
      const found = this.jobs.find((job) => job.idempotency_key === params[0]);
      return { rows: found ? [{ ...found }] : [] };
    }
    if (sql.includes('FROM crm_cp_render_jobs') && sql.includes('id =')) {
      const found = this.jobs.find((job) => job.id === params[0]);
      return { rows: found ? [{ ...found }] : [] };
    }
    if (sql.includes('UPDATE crm_cp_render_jobs')) {
      const job = this.jobs.find((item) => item.id === params[params.length - 1]);
      if (!job) return { rows: [] };
      if (sql.includes("state = 'queued'") && job.state !== 'queued') return { rows: [] };
      if (sql.includes('SET state =')) job.state = String(params[0]);
      const raw = params.find((value) => typeof value === 'string' && value.startsWith('{'));
      if (raw) job.stage_log_json = JSON.parse(String(raw));
      return { rows: [{ ...job }] };
    }
    if (sql.includes('INSERT INTO crm_cp_provider_runs')) {
      this.runs.push({ external_run_id: params[4] });
      return { rows: [{ id: 'run-1' }] };
    }
    return { rows: [] };
  }
}

describe('Magnific flows acceptance', () => {
  const envBackup = process.env;

  beforeEach(() => {
    process.env = {
      ...envBackup,
      MAGNIFIC_REST_API_ENABLED: '1',
      MAGNIFIC_FLOWS_ENABLED: '1',
    };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('draft → confirm → submit → ingest with mocked flow adapter', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cp-flow-acc-'));
    process.env.CP_ASSET_STORAGE = root;
    const db = new JobsMemory();
    const ledgerDb = new LedgerMemory();
    const mp4 = Buffer.from('fake-mp4');
    const adapter: MagnificAdapterPort = {
      getBalance: jest.fn(async () => ({ credits: 99 })),
      generate: jest.fn(),
      wait: jest.fn(),
      download: jest.fn(async () => ({ bytes: mp4, mime: 'video/mp4' })),
    };
    const flowsAdapter = {
      runFlow: jest.fn(async () => ({ workflowRunIdentifier: 'acc-run-1' })),
      waitForRun: jest.fn(async () => ({
        outputUrls: ['https://cdn.example/acc.mp4'],
        status: 'completed',
      })),
    } as unknown as CpMagnificFlowsAdapter;
    const flowTemplates = {
      validateDraft: jest.fn(async () => ({
        flow_inputs: { image_prompt: 'hero', motion_prompt: 'push' },
        estimate: { credits: 5, duration_sec: 5 },
        bindings: { execution_kind: 'flow', flow_sqid: FLOW_SQID, input_bindings: {} },
        flow_sqid: FLOW_SQID,
      })),
      listForProject: jest.fn(async () => [{
        template_id: TEMPLATE_ID,
        name: 'Social 9:16',
        flow_sqid: FLOW_SQID,
        estimate_credits: 5,
        fields: [],
        bindings: { execution_kind: 'flow', flow_sqid: FLOW_SQID, input_bindings: {} },
      }]),
    } as unknown as CpMagnificFlowTemplatesService;
    const assets = {
      createAsset: jest.fn(async () => ({ id: 'asset-acc-1' })),
      replaceFile: jest.fn(async () => ({ id: 'ver-1' })),
      finalizeIngest: jest.fn(async () => ({
        id: 'asset-acc-1',
        hash: createHash('sha256').update(mp4).digest('hex'),
        state: 'ready',
      })),
    };
    const service = new CpJobsService(
      new CpJobsRepository(db),
      new CpLedgerService(ledgerDb),
      adapter,
      { get: jest.fn(async () => ({ high_cost_threshold: 200 })) } as never,
      assets as never,
      undefined,
      flowTemplates,
      flowsAdapter,
    );

    const drafted = await service.draft(9, {
      project_id: PROJECT_ID,
      provider: 'magnific_rest',
      execution_kind: 'flow',
      template_id: TEMPLATE_ID,
      inputs: { image_prompt: 'hero', motion_prompt: 'push' },
      idempotency_key: 'acc-flow-1',
    });
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);
    const ingested = await service.ingest(9, drafted.job_id);

    expect(flowsAdapter.runFlow).toHaveBeenCalledTimes(1);
    expect(ingested).toMatchObject({ state: 'qc', asset_id: 'asset-acc-1' });
    rmSync(root, { recursive: true, force: true });
  });

  it('second submit does not duplicate provider run (GT-MF06)', async () => {
    const db = new JobsMemory();
    const runFlow = jest.fn(async () => ({ workflowRunIdentifier: 'acc-run-2' }));
    const service = new CpJobsService(
      new CpJobsRepository(db),
      new CpLedgerService(new LedgerMemory()),
      {
        getBalance: jest.fn(async () => ({ credits: 99 })),
        generate: jest.fn(),
        wait: jest.fn(),
        download: jest.fn(),
      },
      { get: jest.fn(async () => ({ high_cost_threshold: 200 })) } as never,
      undefined,
      undefined,
      {
        validateDraft: jest.fn(async () => ({
          flow_inputs: { image_prompt: 'a', motion_prompt: 'b' },
          estimate: { credits: 5, duration_sec: 5 },
          bindings: { execution_kind: 'flow', flow_sqid: FLOW_SQID, input_bindings: {} },
          flow_sqid: FLOW_SQID,
        })),
      } as never,
      { runFlow, waitForRun: jest.fn() } as never,
    );
    const drafted = await service.draft(9, {
      project_id: PROJECT_ID,
      provider: 'magnific_rest',
      execution_kind: 'flow',
      template_id: TEMPLATE_ID,
      inputs: { image_prompt: 'a', motion_prompt: 'b' },
      idempotency_key: 'acc-idem',
    });
    await service.confirm(9, drafted.job_id, { confirm: true });
    await service.submit(9, drafted.job_id);
    await expect(service.submit(9, drafted.job_id)).rejects.toMatchObject({
      error: 'job_not_submittable',
    });
    expect(runFlow).toHaveBeenCalledTimes(1);
  });
});
