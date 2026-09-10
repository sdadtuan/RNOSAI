import { CpSopIngestService } from './cp-sop-ingest.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const DRAFT_ID = '22222222-2222-4222-8222-222222222222';
const VERSION_ID = '33333333-3333-4333-8333-333333333333';
const scope = { scope: 'all' as const, staffId: 9, teamIds: [] };

function makeSvc(opts: {
  query?: jest.Mock;
  transaction?: jest.Mock;
  upsertDraft?: jest.Mock;
  patchDraft?: jest.Mock;
  getDraft?: jest.Mock;
  qcRun?: jest.Mock;
}) {
  const query = opts.query ?? jest.fn(async () => ({ rows: [] }));
  const transaction = opts.transaction
    ?? jest.fn(async (work: (tx: { query: jest.Mock }) => Promise<unknown>) => work({ query }));
  const videos = {
    upsertDraft: opts.upsertDraft
      ?? jest.fn().mockResolvedValue({ id: DRAFT_ID, config_json: {} }),
    patchDraft: opts.patchDraft
      ?? jest.fn().mockResolvedValue({ id: DRAFT_ID, config_json: { playbook_id: 'tvc_short_169' } }),
    get: opts.getDraft
      ?? jest.fn().mockResolvedValue({ id: DRAFT_ID, config_json: {} }),
  };
  const qc = {
    run: opts.qcRun ?? jest.fn().mockResolvedValue({ qc_status: 'passed' }),
  };
  const svc = new CpSopIngestService(
    { query, transaction } as never,
    videos as never,
    qc as never,
  );
  return { svc, query, transaction, videos, qc };
}

describe('CpSopIngestService', () => {
  it('creates a draft, inserts a version, and skips QC without facts', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: DRAFT_ID }] };
      if (sql.includes('COALESCE(MAX(version_n)')) return { rows: [{ next_n: 2 }] };
      if (sql.includes('INSERT INTO crm_cp_video_versions')) {
        return {
          rows: [{
            id: VERSION_ID,
            draft_id: DRAFT_ID,
            version_n: 2,
            output_uri: 'file:///tmp/the-peak.mp4',
            qc_status: null,
          }],
        };
      }
      return { rows: [] };
    });
    const { svc, videos, qc } = makeSvc({ query });

    await expect(
      svc.ingestFromSop(
        {
          project_id: PROJECT_ID,
          name: 'The Peak TVC',
          output_uri: 'file:///tmp/the-peak.mp4',
        },
        scope,
      ),
    ).resolves.toEqual({
      draft_id: DRAFT_ID,
      version_id: VERSION_ID,
      href: `/crm/creative-os/video/${DRAFT_ID}?version=${VERSION_ID}`,
      qc_status: null,
    });

    expect(videos.upsertDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: PROJECT_ID,
        name: 'The Peak TVC',
        input_mode: 'url',
        config_json: expect.objectContaining({ playbook_id: 'tvc_short_169' }),
      }),
      scope,
    );
    expect(qc.run).not.toHaveBeenCalled();
  });

  it('updates an existing draft and runs tvc_short QC when facts are provided', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: DRAFT_ID }] };
      if (sql.includes('COALESCE(MAX(version_n)')) return { rows: [{ next_n: 1 }] };
      if (sql.includes('INSERT INTO crm_cp_video_versions')) {
        return {
          rows: [{
            id: VERSION_ID,
            draft_id: DRAFT_ID,
            output_uri: '/tmp/the-peak.mp4',
            qc_status: null,
          }],
        };
      }
      return { rows: [] };
    });
    const qcRun = jest.fn().mockResolvedValue({ qc_status: 'warning' });
    const { svc, videos, qc } = makeSvc({ query, qcRun });

    await expect(
      svc.ingestFromSop(
        {
          draft_id: DRAFT_ID,
          project_id: PROJECT_ID,
          name: 'The Peak TVC v2',
          output_uri: '/tmp/the-peak.mp4',
          facts: { width: 1920, height: 1080, duration_sec: 30, has_audio: true },
        },
        scope,
      ),
    ).resolves.toMatchObject({
      draft_id: DRAFT_ID,
      version_id: VERSION_ID,
      qc_status: 'warning',
    });

    expect(videos.patchDraft).toHaveBeenCalled();
    expect(videos.upsertDraft).not.toHaveBeenCalled();
    expect(qc.run).toHaveBeenCalledWith(
      VERSION_ID,
      { width: 1920, height: 1080, duration_sec: 30, has_audio: true },
      scope,
      { pack: 'tvc_short' },
    );
  });

  it('requires project_id, name, and output_uri', async () => {
    const { svc } = makeSvc({});
    await expect(svc.ingestFromSop({}, scope)).rejects.toMatchObject({
      status: 400,
      error: 'project_id_required',
    });
  });
});
