import { CpRenderWorker } from './cp-render.worker';

describe('CpRenderWorker', () => {
  it('completes stub renders with stub:// output uri', async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const db = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [] };
      }),
    };
    const worker = new CpRenderWorker(db as never);

    await worker.process(
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        draft_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        provider: 'stub',
      },
      { pricing_version: 'stub-2026-09' },
      db,
    );

    const versionInsert = queries.find((entry) =>
      entry.sql.includes('INSERT INTO crm_cp_video_versions'));
    expect(versionInsert?.params?.[2]).toBe(
      'stub://renders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('defers video_sop renders when master is not ready', async () => {
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM crm_cp_deliverables')) return { rows: [] };
        if (sql.includes('FROM vd_assets')) return { rows: [] };
        return { rows: [] };
      }),
    };
    const worker = new CpRenderWorker(db as never);

    await worker.process(
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        draft_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        provider: 'video_sop',
      },
      {
        draft: {
          config_json: { vd_project_id: 12 },
        },
        pricing_version: 'sop-2026-09',
      },
      db,
    );

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("stage = 'sop_wait'"),
      expect.any(Array),
    );
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO crm_cp_video_versions'),
      expect.any(Array),
    );
  });

  it('completes video_sop renders when output uri is configured', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [] })),
    };
    const worker = new CpRenderWorker(db as never);

    await worker.process(
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        draft_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        provider: 'video_sop',
      },
      {
        draft: {
          config_json: {
            vd_project_id: 3,
            output_uri: 'file:///tmp/the-peak.mp4',
          },
        },
        pricing_version: 'sop-2026-09',
      },
      db,
    );

    const versionInsert = (db.query as jest.Mock).mock.calls.find(
      ([sql]) => sql.includes('INSERT INTO crm_cp_video_versions'),
    );
    expect(versionInsert?.[1]?.[2]).toBe('file:///tmp/the-peak.mp4');
    expect(versionInsert?.[1]?.[3]).toBe('sop-2026-09');
  });

  it('does not double-ingest the same queued row when poll ticks overlap', async () => {
    let releaseIngest: (() => void) | undefined;
    const ingestGate = new Promise<void>((resolve) => {
      releaseIngest = resolve;
    });
    let ingestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      ingestStarted = resolve;
    });
    const ingest = jest.fn(async () => {
      ingestStarted();
      await ingestGate;
      return { state: 'quality_check' };
    });
    const queued = {
      id: '99999999-9999-4999-8999-999999999999',
      provider: 'magnific_mcp',
      created_by_staff_id: 9,
      state: 'queued',
    };
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("provider LIKE 'magnific%'") && sql.includes("state = 'queued'")) {
          return { rows: [{ ...queued }] };
        }
        return { rows: [] };
      }),
    };
    const worker = new CpRenderWorker(db as never, { ingest } as never);

    const first = worker.pollMagnificQueuedJobs();
    await started;
    const second = worker.pollMagnificQueuedJobs();
    releaseIngest?.();
    await Promise.all([first, second]);

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledWith(9, queued.id);
  });

  it('does not mark a running comfy job ASSET_SYNC_FAILED on the first empty history tick', async () => {
    const ingest = jest.fn(async () => ({ state: 'queued' }));
    const queued = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      provider: 'comfyui',
      created_by_staff_id: 9,
      state: 'queued',
    };
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("provider = 'comfyui'") || sql.includes('comfyui')) {
          if (sql.includes("state = 'queued'")) return { rows: [{ ...queued }] };
        }
        if (sql.includes("provider LIKE 'magnific%'") && sql.includes("state = 'queued'")) {
          return { rows: [{ ...queued }] };
        }
        return { rows: [] };
      }),
    };
    const worker = new CpRenderWorker(db as never, { ingest } as never);

    const completed = await worker.pollMagnificQueuedJobs();

    expect(ingest).toHaveBeenCalledWith(9, queued.id);
    expect(completed).toBe(1);
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('ASSET_SYNC_FAILED'),
      expect.anything(),
    );
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('missing_output_url'),
      expect.anything(),
    );
  });

  it('routes magnific_* jobs through ingest instead of the stub renderer', async () => {
    const ingest = jest.fn(async () => ({ state: 'quality_check' }));
    const db = {
      query: jest.fn(async () => ({ rows: [] })),
    };
    const worker = new CpRenderWorker(db as never, { ingest } as never);

    await worker.process(
      {
        id: '99999999-9999-4999-8999-999999999999',
        provider: 'magnific_mcp',
      },
      {},
      db,
    );

    expect(ingest).toHaveBeenCalledWith(
      expect.any(Number),
      '99999999-9999-4999-8999-999999999999',
    );
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO crm_cp_video_versions'),
      expect.any(Array),
    );
  });
});
