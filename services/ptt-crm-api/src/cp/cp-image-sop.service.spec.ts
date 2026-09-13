import { HttpException } from '@nestjs/common';
import { CpImageSopRepository } from './cp-image-sop.repository';
import { CpImageSopService } from './cp-image-sop.service';

class ServiceMemory {
  sops: Record<string, unknown>[] = [];
  projects: Record<string, unknown>[] = [];
  jobs: Record<string, unknown>[] = [];
  frames: Record<string, unknown>[] = [];
  stages: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('COUNT(*)::int AS cnt') && sql.includes('crm_cp_provider_connections')) {
      return { rows: [{ cnt: params[0] ?? 0 }] };
    }
    if (sql.includes('INSERT INTO img_projects')) {
      const row = {
        id: 'proj-1',
        tenant_id: 'PTT',
        agency_client_id: params[2],
        service_lifecycle_id: params[3],
        sop_version_id: params[4],
        name: params[5],
        status: 'draft',
        brief_json: JSON.parse(String(params[6])),
        created_by_staff_id: params[7],
        g1_at: null,
        g2_at: null,
        g3_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.projects.push(row);
      return { rows: [row] };
    }
    if (sql.includes('INSERT INTO img_frames')) {
      const row = { id: 'frame-1', project_id: params[0], intent: params[3] };
      this.frames.push(row);
      return { rows: [row] };
    }
    if (sql.includes('INSERT INTO img_jobs')) {
      const key = String(params[6]);
      const existing = this.jobs.find((j) => j.idempotency_key === key);
      if (existing) return { rows: [] };
      const row = {
        id: 'job-1',
        project_id: params[0],
        frame_id: params[1],
        provider: params[2],
        route_decision_json: JSON.parse(String(params[3])),
        state: params[4],
        estimate_credits: params[5],
        idempotency_key: key,
        winner_asset_id: null,
        intent: 'hero_lifestyle',
        format_pack_json: null,
      };
      this.jobs.push(row);
      return { rows: [row] };
    }
    if (sql.includes('FROM img_jobs') && sql.includes('idempotency_key')) {
      const found = this.jobs.find((j) => j.idempotency_key === params[0]);
      return { rows: found ? [found] : [] };
    }
    if (sql.includes('FROM img_jobs j') && sql.includes('WHERE j.id')) {
      const found = this.jobs.find((j) => j.id === params[0]);
      if (!found) return { rows: [] };
      const frame = this.frames.find((f) => f.id === found.frame_id);
      return {
        rows: [
          {
            ...found,
            winner_asset_id: frame?.winner_asset_id ?? found.winner_asset_id ?? null,
            intent: frame?.intent ?? found.intent,
            format_pack_json: frame?.format_pack_json ?? found.format_pack_json ?? null,
          },
        ],
      };
    }
    if (sql.includes('FROM img_projects WHERE id')) {
      const found = this.projects.find((p) => p.id === params[0]);
      return { rows: found ? [found] : [] };
    }
    if (sql.includes('UPDATE img_frames') && sql.includes('winner_asset_id')) {
      const frame = this.frames.find((f) => f.id === 'frame-1');
      if (frame) frame.winner_asset_id = params[1];
      return { rows: [] };
    }
    if (sql.includes('UPDATE img_frames') && sql.includes('format_pack_json')) {
      const frame = this.frames.find((f) => f.id === params[0]);
      if (frame) frame.format_pack_json = JSON.parse(String(params[1]));
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO img_job_stages')) {
      const row = {
        id: `stage-${this.stages.length + 1}`,
        job_id: params[0],
        stage: params[1],
        sort_order: params[2],
        capability: params[3],
        provider: params[4],
        state: params[5],
        cp_render_job_id: params[6],
      };
      this.stages.push(row);
      return { rows: [row] };
    }
    if (sql.includes('FROM img_jobs j') && sql.includes('ORDER BY')) {
      return {
        rows: this.jobs.map((job) => {
          const frame = this.frames.find((f) => f.id === job.frame_id);
          return {
            ...job,
            winner_asset_id: frame?.winner_asset_id ?? null,
            format_pack_json: frame?.format_pack_json ?? null,
          };
        }),
      };
    }
    if (sql.includes('COUNT(*)::int AS cnt') && sql.includes('crm_cp_assets')) {
      return { rows: [{ cnt: 0 }] };
    }
    if (sql.includes('SUM(amount)')) {
      return { rows: [{ total: 0 }] };
    }
    if (sql.includes('AVG(EXTRACT')) {
      return { rows: [{ avg_hours: null }] };
    }
    if (sql.includes("stage = 'explore'")) {
      return { rows: [{ cnt: 0 }] };
    }
    return { rows: [] };
  }

  setMagnificCount(n: number) {
    const original = this.query.bind(this);
    this.query = async (sql: string, params: unknown[] = []) => {
      if (sql.includes('crm_cp_provider_connections')) {
        return { rows: [{ cnt: n }] };
      }
      return original(sql, params);
    };
  }
}

function makeService(opts?: { enabled?: boolean; magnificCount?: number; cpJobs?: unknown }) {
  const db = new ServiceMemory();
  db.setMagnificCount(opts?.magnificCount ?? 0);
  const repo = new CpImageSopRepository(db);
  const env: NodeJS.ProcessEnv = {
    CP_IMAGE_SOP_ENABLED: opts?.enabled === false ? '0' : '1',
    MAGNIFIC_REST_API_ENABLED: '1',
  };
  const cpJobs = opts?.cpJobs ?? {
    draft: jest.fn(),
    confirm: jest.fn(),
    submit: jest.fn(),
  };
  const service = new CpImageSopService(repo, cpJobs as never, env);
  return { service, db, cpJobs };
}

describe('CpImageSopService', () => {
  it('draft without flag throws image_sop_disabled', async () => {
    const { service } = makeService({ enabled: false });
    expect(() => service.assertEnabled()).toThrow(
      expect.objectContaining({ error: 'image_sop_disabled' }),
    );
    await expect(
      service.draftJob(
        {
          agency_client_id: 1,
          sop_version_id: 'v1',
          intent: 'hero_lifestyle',
          variants: 2,
          creative_direction: 'test',
          idempotency_key: 'k1',
        },
        1,
      ),
    ).rejects.toMatchObject({ error: 'image_sop_disabled' });
  });

  it('submit without confirm throws 400 human_confirm_required', async () => {
    const { service, db } = makeService();
    db.projects.push({ id: 'proj-1', g1_at: new Date().toISOString() });
    db.jobs.push({
      id: 'job-1',
      project_id: 'proj-1',
      route_decision_json: {},
      provider: 'magnific_rest',
      idempotency_key: 'k1',
      frame_id: 'frame-1',
    });
    await expect(service.submitJob('job-1', false, 1)).rejects.toMatchObject({
      error: 'human_confirm_required',
    });
  });

  it('explore when magnific disconnected records stage POLICY_BLOCKED and does not call CpJobsService', async () => {
    const cpJobs = { draft: jest.fn(), confirm: jest.fn(), submit: jest.fn() };
    const { service, db } = makeService({ magnificCount: 0, cpJobs });
    db.jobs.push({
      id: 'job-1',
      project_id: 'proj-1',
      frame_id: 'frame-1',
      route_decision_json: { intent: 'hero_lifestyle' },
      provider: 'magnific_rest',
      idempotency_key: 'k1',
      intent: 'hero_lifestyle',
    });
    const out = await service.explore('job-1', 1);
    expect(out.cp_job_id).toBeNull();
    expect(db.stages[0]?.state).toBe('POLICY_BLOCKED');
    expect(cpJobs.draft).not.toHaveBeenCalled();
  });

  it('selectWinner writes winner_asset_id', async () => {
    const { service, db } = makeService();
    db.jobs.push({
      id: 'job-1',
      project_id: 'proj-1',
      frame_id: 'frame-1',
      route_decision_json: {},
      provider: 'local',
      idempotency_key: 'k1',
    });
    db.frames.push({ id: 'frame-1', project_id: 'proj-1', intent: 'hero_lifestyle' });
    await service.selectWinner('job-1', 'asset-winner', 1);
    expect(db.frames[0]?.winner_asset_id).toBe('asset-winner');
  });

  it('refine before select throws gate GT-I11', async () => {
    const { service, db } = makeService();
    db.jobs.push({
      id: 'job-1',
      project_id: 'proj-1',
      frame_id: 'frame-1',
      route_decision_json: { intent: 'hero_lifestyle' },
      provider: 'local',
      idempotency_key: 'k1',
      winner_asset_id: null,
      intent: 'hero_lifestyle',
    });
    await expect(service.refine('job-1', 'overlay', 1)).rejects.toMatchObject({ gate: 'GT-I11' });
  });

  it('upscale without winner throws GT-I11', async () => {
    const { service, db } = makeService({ magnificCount: 1 });
    db.jobs.push({
      id: 'job-1',
      project_id: 'proj-1',
      frame_id: 'frame-1',
      route_decision_json: {},
      provider: 'magnific_rest',
      idempotency_key: 'k1',
      winner_asset_id: null,
    });
    await expect(service.upscale('job-1', 1)).rejects.toMatchObject({ gate: 'GT-I11' });
  });

  it('pack writes format_pack_json keys for requested ratios', async () => {
    const { service, db } = makeService();
    db.jobs.push({
      id: 'job-1',
      project_id: 'proj-1',
      frame_id: 'frame-1',
      route_decision_json: {},
      provider: 'local',
      idempotency_key: 'k1',
    });
    db.frames.push({
      id: 'frame-1',
      project_id: 'proj-1',
      intent: 'hero_lifestyle',
      winner_asset_id: 'asset-winner',
    });
    const out = await service.pack('job-1', ['1:1', '4:5'], 1);
    expect(out.format_pack_json['1:1']).toBe('asset-winner');
    expect(out.format_pack_json['4:5']).toBe('asset-winner');
    expect(db.frames[0]?.format_pack_json).toEqual(out.format_pack_json);
  });

  it('upscale uses capability images_upscale', async () => {
    const cpJobs = {
      draft: jest.fn().mockResolvedValue({ job_id: 'cp-1' }),
      confirm: jest.fn().mockResolvedValue({}),
      submit: jest.fn().mockResolvedValue({ job_id: 'cp-1' }),
    };
    const { service, db } = makeService({ magnificCount: 1, cpJobs });
    db.jobs.push({
      id: 'job-1',
      project_id: 'proj-1',
      frame_id: 'frame-1',
      route_decision_json: {},
      provider: 'magnific_rest',
      idempotency_key: 'k1',
    });
    db.frames.push({
      id: 'frame-1',
      winner_asset_id: 'asset-winner',
      intent: 'hero_lifestyle',
    });
    await service.upscale('job-1', 1);
    expect(cpJobs.draft).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        inputs: expect.objectContaining({ capability: 'images_upscale' }),
      }),
    );
    expect(db.stages.some((s) => s.capability === 'images_upscale')).toBe(true);
  });

  it('variants > 4 returns 400', async () => {
    const { service } = makeService({ enabled: true });
    process.env.CP_IMAGE_SOP_VARIANT_MAX = '4';
    await expect(
      service.draftJob(
        {
          agency_client_id: 1,
          sop_version_id: 'v1',
          intent: 'hero_lifestyle',
          variants: 5,
          creative_direction: 'test',
          idempotency_key: 'k2',
        },
        1,
      ),
    ).rejects.toMatchObject({ error: 'variants_out_of_range' });
  });

  it('evaluateQuality returns null scores without fake numbers', () => {
    const { service } = makeService();
    const out = service.evaluateQuality({
      profile: 'brand_kv_v1',
      checks: { technical: 90, brand_fit: null, creative_fit: 90, delivery: 90 },
    });
    expect(out.scores_json.brand_fit).toBeNull();
    expect(out.decision).toBe('ESCALATE');
  });
});
