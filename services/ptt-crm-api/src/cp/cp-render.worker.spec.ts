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
