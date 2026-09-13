import { CpImageSopRepository } from './cp-image-sop.repository';

class ImageSopMemory {
  sops: Record<string, unknown>[] = [];
  projects: Record<string, unknown>[] = [];
  jobs: Record<string, unknown>[] = [];
  stages: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('FROM img_sop_registry') && sql.includes('ORDER BY r.code')) {
      return { rows: [...this.sops] };
    }
    if (sql.includes('INSERT INTO img_projects')) {
      const row = {
        id: 'proj-1',
        tenant_id: 'PTT',
        agency_client_id: params[2],
        name: params[5],
        status: 'draft',
        brief_json: JSON.parse(String(params[6])),
        created_by_staff_id: params[7],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        g1_at: null,
        g2_at: null,
        g3_at: null,
      };
      this.projects.push(row);
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
      };
      this.jobs.push(row);
      return { rows: [row] };
    }
    if (sql.includes('FROM img_jobs') && sql.includes('idempotency_key')) {
      const found = this.jobs.find((j) => j.idempotency_key === params[0]);
      return { rows: found ? [found] : [] };
    }
    if (sql.includes('INSERT INTO img_job_stages')) {
      const row = {
        id: 'stage-1',
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
    if (sql.includes('UPDATE img_frames') && sql.includes('winner_asset_id')) {
      return { rows: [] };
    }
    if (sql.includes('COUNT(*)::int AS cnt') && sql.includes('crm_cp_assets')) {
      return { rows: [{ cnt: 0 }] };
    }
    if (sql.includes('SUM(amount)')) {
      return { rows: [{ total: 0 }] };
    }
    return { rows: [] };
  }
}

describe('CpImageSopRepository', () => {
  it('lists SOPs', async () => {
    const db = new ImageSopMemory();
    db.sops.push({
      id: 's1',
      code: 'PTT-IMG-KV-45',
      name: 'Brand KV',
      category: 'BRAND_KEY_VISUAL',
      status: 'DRAFT',
      risk_tier: 'MEDIUM',
      data_class: 'INTERNAL',
      version: 'v0.1',
      version_id: 'v1',
      intent: 'hero_lifestyle',
    });
    const repo = new CpImageSopRepository(db);
    const items = await repo.listSops();
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('PTT-IMG-KV-45');
  });

  it('inserts project and job', async () => {
    const db = new ImageSopMemory();
    const repo = new CpImageSopRepository(db);
    const project = await repo.insertProject({
      agency_client_id: 7,
      name: 'Nova KV',
      created_by_staff_id: 1,
    });
    expect(project.agency_client_id).toBe(7);
    const job = await repo.insertJob({
      project_id: project.id,
      provider: 'magnific_rest',
      idempotency_key: 'idem-1',
    });
    expect(job.idempotency_key).toBe('idem-1');
  });

  it('inserts stage row', async () => {
    const db = new ImageSopMemory();
    const repo = new CpImageSopRepository(db);
    const stage = await repo.insertStage({
      job_id: 'job-1',
      stage: 'explore',
      sort_order: 0,
      capability: 'images_generate',
      provider: 'magnific_rest',
      state: 'POLICY_BLOCKED',
    });
    expect(stage.stage).toBe('explore');
    expect(stage.state).toBe('POLICY_BLOCKED');
  });
});
