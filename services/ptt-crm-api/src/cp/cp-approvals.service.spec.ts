import { APPROVAL_STATES, CpApprovalsService } from './cp-approvals.service';

const VERSION_A = '55555555-5555-4555-8555-555555555555';
const VERSION_B = '77777777-7777-4777-8777-777777777777';
const SCOPE = { scope: 'all' as const, staffId: 9 };

const SNAPSHOT_A = {
  draft: {
    name: 'Launch v1',
    input_mode: 'script',
    prompt: null,
    script_json: { text: 'hello' },
    config_json: { ratio: '9:16', duration: 30, estimated_credits: 12 },
    brand_kit_version_id: '11111111-1111-4111-8111-111111111111',
  },
  kit_version: { id: '11111111-1111-4111-8111-111111111111' },
  asset_versions: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
  pricing_version: 'stub-1',
};

const SNAPSHOT_B = {
  draft: {
    name: 'Launch v2',
    input_mode: 'script',
    prompt: null,
    script_json: { text: 'hello world' },
    config_json: { ratio: '9:16', duration: 30, estimated_credits: 18 },
    brand_kit_version_id: '22222222-2222-4222-8222-222222222222',
  },
  kit_version: { id: '22222222-2222-4222-8222-222222222222' },
  asset_versions: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
  ],
  pricing_version: 'stub-2',
};

class VersionPort {
  versions: Record<string, Record<string, unknown>> = {
    [VERSION_A]: {
      id: VERSION_A,
      draft_id: '44444444-4444-4444-8444-444444444444',
      snapshot_json: SNAPSHOT_A,
      approval_status: 'internal_review',
      brand_kit_version_id: '11111111-1111-4111-8111-111111111111',
    },
    [VERSION_B]: {
      id: VERSION_B,
      draft_id: '44444444-4444-4444-8444-444444444444',
      snapshot_json: SNAPSHOT_B,
      approval_status: 'internal_review',
      brand_kit_version_id: '22222222-2222-4222-8222-222222222222',
    },
  };

  async getVersion(id: string) {
    return this.versions[id] ?? Promise.reject(
      Object.assign(new Error('not_found'), { status: 404 }),
    );
  }
}

class ApprovalQuery {
  approvals: Record<string, unknown>[] = [];
  lastSql = '';
  lastParams: unknown[] = [];

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    this.lastParams = params;
    if (sql.includes('UPDATE crm_cp_video_versions')) {
      return {
        rows: [{
          id: params[0],
          approval_status: params[1],
        }],
      };
    }
    if (sql.includes('INSERT INTO crm_cp_approvals')) {
      const row = {
        id: '88888888-8888-4888-8888-888888888888',
        object_type: params[0],
        object_id: params[1],
        step: params[2],
        actor_id: params[3],
        decision: params[4],
        reason: params[5],
      };
      this.approvals.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

describe('CpApprovalsService', () => {
  it('exposes the seven approval states', () => {
    expect(APPROVAL_STATES).toEqual([
      'internal_review',
      'client_review',
      'changes_requested',
      'brand_approved',
      'legal_approved',
      'final_approved',
      'rejected',
    ]);
  });

  it('persists brand_approved on the version and inserts a brand step row', async () => {
    const videos = new VersionPort();
    const db = new ApprovalQuery();
    const approvals = new CpApprovalsService(videos as never, db);

    const result = await approvals.submit(
      VERSION_A,
      { status: 'brand_approved', decision: 'approved', reason: 'kit ok' },
      9,
      SCOPE,
    );

    expect(result.approval_status).toBe('brand_approved');
    expect(db.approvals[0]).toMatchObject({
      object_type: 'video_version',
      object_id: VERSION_A,
      step: 'brand',
      actor_id: 9,
      decision: 'approved',
      reason: 'kit ok',
    });
    expect(db.lastSql).toContain('INSERT INTO crm_cp_approvals');
  });

  it.each([
    ['internal_review', 'internal_review'],
    ['client_review', 'client_review'],
    ['changes_requested', 'internal_review'],
    ['legal_approved', 'legal'],
    ['final_approved', 'final'],
    ['rejected', 'internal_review'],
  ] as const)('maps status %s to approval step %s', async (status, step) => {
    const db = new ApprovalQuery();
    const approvals = new CpApprovalsService(new VersionPort() as never, db);

    await approvals.submit(VERSION_A, { status }, 9, SCOPE);

    expect(db.approvals[0].step).toBe(step);
  });

  it('rejects an unknown approval status', async () => {
    const approvals = new CpApprovalsService(new VersionPort() as never, new ApprovalQuery());

    await expect(
      approvals.submit(VERSION_A, { status: 'draft' }, 9, SCOPE),
    ).rejects.toMatchObject({ status: 400, error: 'invalid_approval_status' });
  });

  it('compareVersions diffs metadata, script, kit id, asset ids, and cost', async () => {
    const approvals = new CpApprovalsService(new VersionPort() as never, new ApprovalQuery());

    const diff = await approvals.compareVersions(VERSION_A, VERSION_B, SCOPE);

    expect(diff.metadata.changed).toBe(true);
    expect(diff.script.changed).toBe(true);
    expect(diff.kit_id.changed).toBe(true);
    expect(diff.kit_id.a).toBe('11111111-1111-4111-8111-111111111111');
    expect(diff.kit_id.b).toBe('22222222-2222-4222-8222-222222222222');
    expect(diff.asset_ids.changed).toBe(true);
    expect(diff.cost.changed).toBe(true);
  });
});
