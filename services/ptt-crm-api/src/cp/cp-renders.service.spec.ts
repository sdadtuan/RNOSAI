import { firstValueFrom } from 'rxjs';
import { CpLedgerService } from './cp-ledger.service';
import { mapRenderJobEvent, renderEventType } from './cp-render-events.util';
import { CpRendersService } from './cp-renders.service';
import { CpRenderWorker } from './cp-render.worker';

class BlockedDraftQuery {
  transaction<T>(work: (tx: BlockedDraftQuery) => Promise<T>) {
    return work(this);
  }

  async query(sql: string) {
    if (sql.includes('FROM crm_cp_render_jobs')) return { rows: [] };
    if (sql.includes('FROM crm_cp_video_drafts')) {
      return {
        rows: [{
          id: '66666666-6666-4666-8666-666666666666',
          project_id: '77777777-7777-4777-8777-777777777777',
          agency_client_id: '88888888-8888-4888-8888-888888888888',
          config_json: {},
          asset_state: 'processing',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    return { rows: [] };
  }
}

class CrossDraftKeyQuery {
  draftLoaded = false;

  transaction<T>(work: (tx: CrossDraftKeyQuery) => Promise<T>) {
    return work(this);
  }

  async query(sql: string) {
    if (sql.includes('FROM crm_cp_video_drafts')) {
      this.draftLoaded = true;
      return {
        rows: [{
          id: '99999999-9999-4999-8999-999999999999',
          project_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          agency_client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          config_json: { estimated_credits: 3 },
          asset_state: 'ready',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    if (sql.includes('FROM crm_cp_render_jobs')) {
      if (sql.includes('j.draft_id = $2')) return { rows: [] };
      return {
        rows: [{
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          draft_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          idempotency_key: 'shared-key',
          estimate: 9,
        }],
      };
    }
    if (sql.includes('INSERT INTO crm_cp_render_jobs')) return { rows: [] };
    return { rows: [] };
  }
}

class ReplayBlockedDraftQuery {
  transaction<T>(work: (tx: ReplayBlockedDraftQuery) => Promise<T>) {
    return work(this);
  }

  async query(sql: string) {
    if (sql.includes('FROM crm_cp_video_drafts')) {
      return {
        rows: [{
          id: '12121212-1212-4212-8212-121212121212',
          project_id: '13131313-1313-4313-8313-131313131313',
          agency_client_id: '14141414-1414-4414-8414-141414141414',
          config_json: { estimated_credits: 4 },
          asset_state: 'processing',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    if (sql.includes('FROM crm_cp_render_jobs')) {
      return {
        rows: [{
          id: '15151515-1515-4515-8515-151515151515',
          draft_id: '12121212-1212-4212-8212-121212121212',
          idempotency_key: 'replay-key',
          estimate: 4,
          state: 'completed',
        }],
      };
    }
    return { rows: [] };
  }
}

describe('CpRendersService', () => {
  it('block reasons from render-block util abort submit', async () => {
    const db = new BlockedDraftQuery();
    const ledger = new CpLedgerService(db);
    const worker = { process: jest.fn() } as unknown as CpRenderWorker;
    const renders = new CpRendersService(db, ledger, worker);

    await expect(
      renders.submit('66666666-6666-4666-8666-666666666666', 'k'),
    ).rejects.toMatchObject({
      response: { error: 'render_blocked' },
    });
  });

  it('does not return a matching key from another draft', async () => {
    const db = new CrossDraftKeyQuery();
    const ledger = new CpLedgerService(db);
    const worker = { process: jest.fn() } as unknown as CpRenderWorker;
    const renders = new CpRendersService(db, ledger, worker);

    await expect(
      renders.submit('99999999-9999-4999-8999-999999999999', 'shared-key'),
    ).rejects.toMatchObject({
      response: { error: 'idempotency_key_conflict' },
    });
    expect(db.draftLoaded).toBe(true);
  });

  it('replays an existing job before re-validating render gates', async () => {
    const db = new ReplayBlockedDraftQuery();
    const ledger = new CpLedgerService(db);
    const worker = { process: jest.fn() } as unknown as CpRenderWorker;
    const renders = new CpRendersService(db, ledger, worker);

    const result = await renders.submit(
      '12121212-1212-4212-8212-121212121212',
      'replay-key',
    );

    expect(result.job_id).toBe('15151515-1515-4515-8515-151515151515');
    expect(worker.process).not.toHaveBeenCalled();
  });

  it('locks the draft before allocating the next version number', async () => {
    const queries: string[] = [];
    const db = {
      async query(sql: string) {
        queries.push(sql);
        return { rows: [] };
      },
    };
    const worker = new CpRenderWorker(db);

    await worker.process(
      {
        id: '16161616-1616-4616-8616-161616161616',
        draft_id: '17171717-1717-4717-8717-171717171717',
      },
      {},
    );

    const lock = queries.findIndex(
      (sql) => sql.includes('crm_cp_video_drafts') && sql.includes('FOR UPDATE'),
    );
    const allocate = queries.findIndex((sql) =>
      sql.includes('INSERT INTO crm_cp_video_versions'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(allocate);
  });

  it('records elapsed duration_sec on the stub completion log', async () => {
    const payloads: unknown[] = [];
    const db = {
      async query(_sql: string, params?: unknown[]) {
        if (params?.[1]) payloads.push(params[1]);
        return { rows: [] };
      },
    };
    const worker = new CpRenderWorker(db);

    await worker.process(
      {
        id: '18181818-1818-4818-8818-181818181818',
        draft_id: '19191919-1919-4919-8919-191919191919',
      },
      {},
    );

    const completed = payloads
      .map((payload) => JSON.parse(String(payload)) as Array<Record<string, unknown>>)
      .flat()
      .find((entry) => entry.stage === 'completed');
    expect(typeof completed?.duration_sec).toBe('number');
    expect(Number(completed?.duration_sec)).toBeGreaterThanOrEqual(0);
  });
});

describe('render SSE events', () => {
  const jobId = '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a';

  it('maps job states onto the published render event names', () => {
    expect(renderEventType('queued')).toBe('cp.video.render.queued');
    expect(renderEventType('rendering')).toBe('cp.video.render.progressed');
    expect(renderEventType('completed')).toBe('cp.video.render.completed');
    expect(renderEventType('failed')).toBe('cp.video.render.failed');
  });

  it('emits the current job snapshot and completes when the job is terminal', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: jobId,
          state: 'completed',
          stage: 'completed',
          progress: 100,
        }],
      }),
      transaction: jest.fn(),
    };
    const renders = new CpRendersService(
      db as never,
      { reserve: jest.fn(), charge: jest.fn() } as never,
      { process: jest.fn() } as never,
    );

    const event = await firstValueFrom(renders.streamEvents(jobId, { scope: 'all', staffId: 0 }));

    expect(event.data).toEqual(mapRenderJobEvent({
      id: jobId,
      state: 'completed',
      stage: 'completed',
      progress: 100,
    }));
    expect(db.query).toHaveBeenCalled();
  });
});

const FALLBACK_DRAFT_ID = '21212121-2121-4212-8212-212121212121';
const FALLBACK_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const FALLBACK_CLIENT_ID = '23232323-2323-4232-8232-232323232323';
const PARENT_JOB_ID = '24242424-2424-4242-8242-242424242424';
const CHILD_JOB_ID = '25252525-2525-4252-8252-252525252525';

class FallbackRenderQuery {
  jobs: Record<string, unknown>[] = [];
  settings: Record<string, unknown>;
  lastChildSnapshot: Record<string, unknown> | null = null;

  constructor(settings: Record<string, unknown>) {
    this.settings = settings;
  }

  transaction<T>(work: (tx: FallbackRenderQuery) => Promise<T>) {
    return work(this);
  }

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('FROM crm_cp_settings')) {
      return { rows: [this.settings] };
    }
    if (sql.includes('FROM crm_cp_video_drafts')) {
      return {
        rows: [{
          id: FALLBACK_DRAFT_ID,
          project_id: FALLBACK_PROJECT_ID,
          agency_client_id: FALLBACK_CLIENT_ID,
          config_json: { estimated_credits: 4, model: 'stub-pro' },
          asset_state: 'ready',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    if (sql.includes('INSERT INTO crm_cp_render_jobs')) {
      const job = {
        id: this.jobs.length ? CHILD_JOB_ID : PARENT_JOB_ID,
        draft_id: params[0],
        parent_job_id: params[1],
        batch_item_id: params[2],
        state: 'queued',
        stage: 'queued',
        progress: 0,
        provider: 'stub',
        model: params[7] ?? null,
        idempotency_key: params[3],
        correlation_id: params[4],
        attempt: params[6],
        estimate: 4,
      };
      this.jobs.push(job);
      return { rows: [job] };
    }
    if (sql.includes('UPDATE crm_cp_render_jobs') && sql.includes("state = 'failed'")) {
      const job = this.jobs.find((row) => String(row.id) === String(params[0])) ?? this.jobs[0];
      if (job) {
        job.state = 'failed';
        job.stage = 'failed';
      }
      return { rows: job ? [job] : [] };
    }
    if (sql.includes('FROM crm_cp_render_jobs')) {
      if (sql.includes('j.idempotency_key')) {
        const key = params[0];
        return { rows: this.jobs.filter((row) => row.idempotency_key === key) };
      }
      return { rows: this.jobs.filter((row) => String(row.id) === String(params[0])) };
    }
    return { rows: [] };
  }
}

describe('model routing fallback child jobs', () => {
  it('creates a child job when a failed job has routing_json.fallback_id', async () => {
    const db = new FallbackRenderQuery({
      routing_json: { fallback_id: 'stub-lite' },
      models_json: [{ id: 'stub-pro', fallback_id: 'stub-lite' }],
    });
    const process = jest.fn(async (job: Record<string, unknown>, snapshot: Record<string, unknown>, tx: FallbackRenderQuery) => {
      if (job.parent_job_id) {
        db.lastChildSnapshot = snapshot;
        job.state = 'completed';
        return;
      }
      await tx.query(
        `UPDATE crm_cp_render_jobs SET state = 'failed' WHERE id = $1::uuid`,
        [job.id],
      );
    });
    const renders = new CpRendersService(
      db,
      { reserve: jest.fn().mockResolvedValue(undefined) } as never,
      { process } as never,
    );

    const result = await renders.submit(FALLBACK_DRAFT_ID, 'fallback-key');

    expect(db.jobs).toHaveLength(2);
    expect(db.jobs[1]).toMatchObject({
      parent_job_id: PARENT_JOB_ID,
      idempotency_key: 'fallback-key:r2',
    });
    expect(result.parent_job_id).toBe(PARENT_JOB_ID);
    expect(db.lastChildSnapshot).toEqual(expect.objectContaining({
      pricing_version: expect.any(String),
    }));
    expect(db.lastChildSnapshot?.pricing_version).toBe(
      (process.mock.calls[0]?.[1] as Record<string, unknown>).pricing_version,
    );
  });

  it('uses the model fallback_id when routing_json has none', async () => {
    const db = new FallbackRenderQuery({
      routing_json: {},
      models_json: [{ id: 'stub-pro', fallback_id: 'stub-lite' }],
    });
    const process = jest.fn(async (job: Record<string, unknown>, _snapshot: unknown, tx: FallbackRenderQuery) => {
      if (!job.parent_job_id) {
        await tx.query(
          `UPDATE crm_cp_render_jobs SET state = 'failed' WHERE id = $1::uuid`,
          [job.id],
        );
      }
    });
    const renders = new CpRendersService(
      db,
      { reserve: jest.fn().mockResolvedValue(undefined) } as never,
      { process } as never,
    );

    await renders.submit(FALLBACK_DRAFT_ID, 'model-fallback-key');

    expect(db.jobs).toHaveLength(2);
    expect(db.jobs[1].parent_job_id).toBe(PARENT_JOB_ID);
  });

  it('does not create a child job when no fallback is configured', async () => {
    const db = new FallbackRenderQuery({
      routing_json: {},
      models_json: [{ id: 'stub-pro' }],
    });
    const process = jest.fn(async (job: Record<string, unknown>, _snapshot: unknown, tx: FallbackRenderQuery) => {
      await tx.query(
        `UPDATE crm_cp_render_jobs SET state = 'failed' WHERE id = $1::uuid`,
        [job.id],
      );
    });
    const renders = new CpRendersService(
      db,
      { reserve: jest.fn().mockResolvedValue(undefined) } as never,
      { process } as never,
    );

    const result = await renders.submit(FALLBACK_DRAFT_ID, 'no-fallback-key');

    expect(db.jobs).toHaveLength(1);
    expect(result.parent_job_id).toBeNull();
    expect(result.state).toBe('failed');
  });
});
