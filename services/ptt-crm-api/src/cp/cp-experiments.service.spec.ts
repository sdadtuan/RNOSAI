import { CpExperimentsService } from './cp-experiments.service';

const PROJECT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DRAFT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMPLETED_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EXPERIMENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SCOPE = { scope: 'all' as const, staffId: 9, teamIds: [] };

class ExperimentQuery {
  experiments: Record<string, unknown>[] = [];
  versions: Record<string, unknown>[] = [];
  updates: Array<{ sql: string; params: unknown[] }> = [];

  transaction<T>(work: (tx: ExperimentQuery) => Promise<T>) {
    return work(this);
  }

  constructor() {
    this.versions.push({
      id: COMPLETED_ID,
      draft_id: DRAFT_ID,
      version_n: 1,
      immutable: true,
      snapshot_json: { language: 'vi', pricing_version: 'stub-2026-09' },
    });
  }

  async query(sql: string, params: unknown[] = []) {
    this.updates.push({ sql, params });
    if (sql.includes('INSERT INTO crm_cp_experiments')) {
      const row = {
        id: EXPERIMENT_ID,
        project_id: params[0],
        name: params[1],
        variants_json: typeof params[2] === 'string' ? JSON.parse(String(params[2])) : params[2],
      };
      this.experiments.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE crm_cp_experiments')) {
      const experiment = this.experiments[0];
      if (experiment) {
        experiment.variants_json = typeof params[1] === 'string'
          ? JSON.parse(String(params[1]))
          : params[1];
      }
      return { rows: experiment ? [experiment] : [] };
    }
    if (sql.includes('INSERT INTO crm_cp_video_versions')) {
      const snapshot = typeof params[2] === 'string' ? JSON.parse(String(params[2])) : params[2];
      const row = {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        draft_id: params[0],
        version_n: params[1] ?? 2,
        snapshot_json: snapshot,
        immutable: false,
      };
      this.versions.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE crm_cp_video_versions') && sql.includes('snapshot_json')) {
      const version = this.versions.find((row) => String(row.id) === String(params[0]));
      if (version) version.snapshot_json = params[1];
      return { rows: version ? [version] : [] };
    }
    if (sql.includes('FROM crm_cp_experiments')) {
      return { rows: this.experiments.filter((row) => !params[1] || String(row.id) === String(params[1]) || String(row.project_id) === String(params[1])) };
    }
    if (sql.includes('FROM crm_cp_video_versions')) {
      return { rows: this.versions.filter((row) => String(row.draft_id) === String(params[0]) || String(row.id) === String(params[0])) };
    }
    if (sql.includes('FROM crm_cp_video_drafts')) {
      return {
        rows: [{
          id: DRAFT_ID,
          project_id: PROJECT_ID,
          name: 'Control',
          config_json: { language: 'vi' },
          prompt: 'hook A',
        }],
      };
    }
    if (sql.includes('FROM crm_cp_projects')) {
      return { rows: [{ id: PROJECT_ID, tenant_id: 'PTT', owner_staff_id: 9 }] };
    }
    if (sql.includes('INSERT INTO crm_cp_activity')) {
      return { rows: [] };
    }
    return { rows: [] };
  }
}

describe('CpExperimentsService', () => {
  it('creates an experiment on a project with a variants_json array', async () => {
    const db = new ExperimentQuery();
    const experiments = new CpExperimentsService(db);

    const created = await experiments.create({
      project_id: PROJECT_ID,
      name: 'Hook A/B',
      variants_json: [],
    }, SCOPE);

    expect(created).toMatchObject({
      project_id: PROJECT_ID,
      name: 'Hook A/B',
      variants_json: [],
    });
    expect(db.updates.some((call) => call.sql.includes('INSERT INTO crm_cp_experiments'))).toBe(true);
  });

  it('creates an extra draft snapshot version linked to the experiment', async () => {
    const db = new ExperimentQuery();
    const experiments = new CpExperimentsService(db);
    const experiment = await experiments.create({
      project_id: PROJECT_ID,
      name: 'Hook A/B',
    }, SCOPE);

    const variant = await experiments.createVariant(String(experiment.id), {
      draft_id: DRAFT_ID,
      label: 'B',
    }, SCOPE);

    expect(variant.version.draft_id).toBe(DRAFT_ID);
    expect(variant.version.immutable).toBe(false);
    expect(variant.version.snapshot_json).toEqual(expect.objectContaining({
      experiment_id: experiment.id,
    }));
    expect(Array.isArray(variant.experiment.variants_json)).toBe(true);
    expect(variant.experiment.variants_json).toEqual(expect.arrayContaining([
      expect.objectContaining({ version_id: variant.version.id, label: 'B' }),
    ]));
  });

  it('does not mutate a completed version snapshot when adding an A/B variant', async () => {
    const db = new ExperimentQuery();
    const experiments = new CpExperimentsService(db);
    const experiment = await experiments.create({
      project_id: PROJECT_ID,
      name: 'Hook A/B',
    }, SCOPE);

    await experiments.createVariant(String(experiment.id), {
      draft_id: DRAFT_ID,
      source_version_id: COMPLETED_ID,
      label: 'B',
    }, SCOPE);

    const completed = db.versions.find((row) => row.id === COMPLETED_ID);
    expect(completed?.snapshot_json).toEqual({ language: 'vi', pricing_version: 'stub-2026-09' });
    expect(db.updates.some((call) => (
      call.sql.includes('UPDATE crm_cp_video_versions')
      && call.sql.includes('snapshot_json')
    ))).toBe(false);
    expect(db.versions.filter((row) => row.draft_id === DRAFT_ID)).toHaveLength(2);
  });

  it('locks the draft before allocating a variant version number', async () => {
    const db = new ExperimentQuery();
    const experiments = new CpExperimentsService(db);
    const experiment = await experiments.create({
      project_id: PROJECT_ID,
      name: 'Hook A/B',
    }, SCOPE);

    await experiments.createVariant(String(experiment.id), {
      draft_id: DRAFT_ID,
      label: 'B',
    }, SCOPE);

    const lock = db.updates.findIndex(
      (call) => call.sql.includes('crm_cp_video_drafts') && call.sql.includes('FOR UPDATE'),
    );
    const allocate = db.updates.findIndex((call) =>
      call.sql.includes('INSERT INTO crm_cp_video_versions'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(allocate);
  });

  it('writes an activity row when creating an experiment and a variant', async () => {
    const db = new ExperimentQuery();
    const audit = {
      insert: jest.fn().mockResolvedValue(undefined),
    };
    const experiments = new CpExperimentsService(db, audit as never);
    const experiment = await experiments.create({
      project_id: PROJECT_ID,
      name: 'Hook A/B',
    }, SCOPE);

    await experiments.createVariant(String(experiment.id), {
      draft_id: DRAFT_ID,
      label: 'B',
    }, SCOPE);

    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'experiment_created',
      resource_type: 'experiment',
      actor_id: 9,
    }));
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'experiment_variant_created',
      resource_type: 'video_version',
      actor_id: 9,
    }), db);
  });
});
