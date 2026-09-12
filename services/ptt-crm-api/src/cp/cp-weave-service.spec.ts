import { CpWeaveService } from './cp-weave.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const WO_ID = '33333333-3333-4333-8333-333333333333';
const LIFECYCLE_ID = '44444444-4444-4444-8444-444444444444';

function makeQuery(rowsByMatch: Array<{ match: string | RegExp; rows: Record<string, unknown>[] }>) {
  return jest.fn(async (sql: string) => {
    const found = rowsByMatch.find((entry) =>
      typeof entry.match === 'string' ? sql.includes(entry.match) : entry.match.test(sql),
    );
    return { rows: found?.rows ?? [] };
  });
}

describe('CpWeaveService', () => {
  const prevWeave = process.env.PTT_WEAVE;
  const prevAi = process.env.CP_AI_ENABLED;

  beforeEach(() => {
    process.env.PTT_WEAVE = '1';
    process.env.CP_AI_ENABLED = '0';
    process.env.WEAVE_OPEN_BASE = 'https://app.weavy.ai/';
  });

  afterAll(() => {
    process.env.PTT_WEAVE = prevWeave;
    process.env.CP_AI_ENABLED = prevAi;
  });

  it('create requires project_id and template_key', async () => {
    const svc = new CpWeaveService({ query: jest.fn() } as never);
    await expect(svc.create({}, 9)).rejects.toMatchObject({ status: 400, error: 'project_id_required' });
    await expect(svc.create({ project_id: PROJECT_ID }, 9)).rejects.toMatchObject({
      status: 400,
      error: 'template_key_required',
    });
  });

  it('create inserts a work order with CR-YYYY-MMDD-NNN task_id', async () => {
    const query = makeQuery([
      { match: 'FROM crm_cp_projects', rows: [{
        id: PROJECT_ID,
        agency_client_id: CLIENT_ID,
        lifecycle_id: LIFECYCLE_ID,
        name: 'Nova Mid-autumn',
      }] },
      { match: 'FROM crm_cp_weave_templates', rows: [{
        template_key: 'feed-1x1',
        name_vi: 'Feed vuông 1080',
        weave_flow_url: 'https://weave.figma.com/flows/feed-1x1',
        output_kind: 'image',
        active: true,
      }] },
      { match: 'FROM clients', rows: [{ code: 'NOVA', name: 'Nova' }] },
      { match: 'FROM crm_service_lifecycle', rows: [{ service_slug: 'mid-autumn-2026' }] },
      { match: 'COUNT(*)', rows: [{ n: 27 }] },
      { match: 'INSERT INTO crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        project_id: PROJECT_ID,
        template_key: 'feed-1x1',
        status: 'draft',
        task_id: 'CR-2026-0912-028',
        client_code: 'nova',
        campaign_code: 'mid-autumn-2026',
      }] },
    ]);
    const svc = new CpWeaveService({ query } as never);
    const created = await svc.create({ project_id: PROJECT_ID, template_key: 'feed-1x1' }, 9);
    expect(created.task_id).toMatch(/^CR-\d{4}-\d{4}-\d{3}$/);
    expect(created.status).toBe('draft');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO crm_cp_weave_work_orders'),
      expect.arrayContaining([PROJECT_ID, 'feed-1x1']),
    );
  });

  it('generate-brief transitions draft to brief_ready and returns stub when AI is off', async () => {
    const query = makeQuery([
      { match: 'FROM crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        status: 'draft',
        brief_json: {},
        template_key: 'feed-1x1',
        project_id: PROJECT_ID,
      }] },
      { match: 'FROM crm_cp_projects', rows: [{
        id: PROJECT_ID,
        name: 'Nova Mid-autumn',
        agency_client_id: CLIENT_ID,
        lifecycle_id: LIFECYCLE_ID,
      }] },
      { match: 'UPDATE crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        status: 'brief_ready',
        brief_json: {
          creative_brief: 'stub',
          prompt: 'stub prompt',
          negative_prompt: '',
          shot_list: [],
          output_format: { kind: 'image', width: 1080, height: 1080 },
        },
      }] },
    ]);
    const svc = new CpWeaveService({ query } as never);
    const result = await svc.generateBrief(WO_ID);
    expect(result.ai_stub).toBe(true);
    expect(result.status).toBe('brief_ready');
    expect((result.brief_json as { prompt?: string }).prompt).toBeTruthy();
  });

  it('open returns href with wo and marks opened', async () => {
    const query = makeQuery([
      { match: 'FROM crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        status: 'brief_ready',
        project_id: PROJECT_ID,
        template_key: 'feed-1x1',
      }] },
      { match: 'FROM crm_cp_weave_templates', rows: [{
        template_key: 'feed-1x1',
        weave_flow_url: 'https://weave.figma.com/flows/feed-1x1',
      }] },
      { match: 'UPDATE crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        status: 'opened',
      }] },
    ]);
    const svc = new CpWeaveService({ query } as never);
    const result = await svc.open(WO_ID, 9);
    expect(result.href).toContain('wo=');
    expect(result.href).toContain(WO_ID);
  });

  it('rejects illegal status transitions with 409', async () => {
    const query = makeQuery([
      { match: 'FROM crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        status: 'draft',
        project_id: PROJECT_ID,
        template_key: 'feed-1x1',
      }] },
    ]);
    const svc = new CpWeaveService({ query } as never);
    await expect(svc.open(WO_ID, 9)).rejects.toMatchObject({
      status: 409,
      error: 'illegal_weave_transition',
    });
  });

  it('returns 404 when PTT_WEAVE is off', async () => {
    process.env.PTT_WEAVE = '0';
    const svc = new CpWeaveService({ query: jest.fn() } as never);
    await expect(svc.create({ project_id: PROJECT_ID, template_key: 'feed-1x1' }, 9)).rejects.toMatchObject({
      status: 404,
      error: 'weave_disabled',
    });
  });

  it('sync-output skips tmp paths and ingesting the same checksum is duplicate', async () => {
    const wo = {
      id: WO_ID,
      status: 'opened',
      task_id: 'CR-2026-0912-028',
      client_code: 'nova',
      campaign_code: 'mid-autumn-2026',
      project_id: PROJECT_ID,
    };
    let checksumSeen = false;
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM crm_cp_weave_work_orders')) return { rows: [wo] };
      if (sql.includes('FROM crm_cp_weave_assets') && sql.includes('checksum')) {
        return { rows: checksumSeen ? [{ id: 'asset-1', checksum: 'abc' }] : [] };
      }
      if (sql.includes('INSERT INTO crm_cp_weave_assets')) {
        checksumSeen = true;
        return { rows: [{ id: 'asset-new', lane: 'final', checksum: 'abc' }] };
      }
      if (sql.includes('INSERT INTO crm_cp_assets')) {
        return { rows: [{ id: 'cp-asset-1' }] };
      }
      if (sql.includes('INSERT INTO crm_cp_provider_runs')) {
        return { rows: [{ id: 'run-1' }] };
      }
      if (sql.includes('INSERT INTO crm_cp_render_jobs')) {
        return { rows: [{ id: 'job-1' }] };
      }
      if (sql.includes('UPDATE crm_cp_weave_work_orders')) {
        return { rows: [{ ...wo, status: 'linked' }] };
      }
      return { rows: [] };
    });
    const storage = {
      list: jest.fn(async () => [
        'nova/mid-autumn-2026/CR-2026-0912-028/tmp/x.png',
        'nova/mid-autumn-2026/CR-2026-0912-028/final/CR-2026-0912-028_v01_9x16.mp4',
      ]),
      read: jest.fn(async () => Buffer.from('video-bytes')),
    };
    const svc = new CpWeaveService({ query } as never, storage);
    const first = await svc.syncOutput(WO_ID);
    expect(first.skipped).toBeGreaterThanOrEqual(1);
    expect(first.warnings.some((w) => w.includes('tmp'))).toBe(true);

    const second = await svc.ingestKey(
      'nova/mid-autumn-2026/CR-2026-0912-028/final/CR-2026-0912-028_v01_9x16.mp4',
    );
    expect(second).toBe('duplicate');
  });

  it('submit-review returns 409 when there is no review or final asset', async () => {
    const query = makeQuery([
      { match: 'FROM crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        status: 'linked',
        project_id: PROJECT_ID,
        agency_client_id: CLIENT_ID,
      }] },
      { match: 'FROM crm_cp_weave_assets', rows: [{ id: 'a1', lane: 'drafts' }] },
    ]);
    const svc = new CpWeaveService({ query } as never);
    await expect(svc.submitReview(WO_ID)).rejects.toMatchObject({
      status: 409,
      error: 'weave_review_assets_required',
    });
  });

  it('deliver returns 409 when QC is blocked', async () => {
    const query = makeQuery([
      { match: 'FROM crm_cp_weave_work_orders', rows: [{
        id: WO_ID,
        status: 'approved',
        project_id: PROJECT_ID,
        qc_status: 'blocked',
      }] },
    ]);
    const svc = new CpWeaveService({ query } as never);
    await expect(svc.deliver(WO_ID)).rejects.toMatchObject({
      status: 409,
      error: 'qc_blocked',
    });
  });

  it('hook rejects a bad HMAC', async () => {
    const svc = new CpWeaveService({ query: jest.fn() } as never);
    process.env.PTT_WEAVE_WEBHOOK_SECRET = 'weave-secret';
    await expect(
      svc.ingestHook(
        '{"key":"nova/mid-autumn-2026/CR-2026-0912-028/final/CR-2026-0912-028_v01_9x16.mp4"}',
        'nope',
      ),
    ).rejects.toMatchObject({ status: 401, error: 'invalid_weave_signature' });
  });
});
