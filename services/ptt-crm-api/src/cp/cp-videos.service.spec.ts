import { CpVideosService } from './cp-videos.service';

class ImmutableVersionQuery {
  async query(sql: string) {
    if (sql.includes('SELECT') && sql.includes('crm_cp_video_versions')) {
      return {
        rows: [{
          id: '55555555-5555-4555-8555-555555555555',
          immutable: true,
        }],
      };
    }
    return { rows: [] };
  }
}

class ScopedVersionQuery {
  lastSql = '';
  lastParams: unknown[] = [];

  constructor(private readonly found = true) {}

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return {
      rows: this.found ? [{
        id: '55555555-5555-4555-8555-555555555555',
        draft_id: '44444444-4444-4444-8444-444444444444',
        version_n: 2,
      }] : [],
    };
  }
}

describe('CpVideosService', () => {
  it('completed version rejects patch', async () => {
    const videos = new CpVideosService(new ImmutableVersionQuery());

    await expect(
      videos.patchVersion('55555555-5555-4555-8555-555555555555', {
        qc_status: 'passed',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('gets a version through its scoped draft and tenant project', async () => {
    const db = new ScopedVersionQuery();
    const videos = new CpVideosService(db);

    const version = await videos.getVersion(
      '55555555-5555-4555-8555-555555555555',
      { scope: 'me', staffId: 42 },
    );

    expect(version).toMatchObject({ version_n: 2 });
    expect(db.lastSql).toContain('crm_cp_video_versions v');
    expect(db.lastSql).toContain('crm_cp_video_drafts d');
    expect(db.lastSql).toContain('crm_cp_projects p');
    expect(db.lastParams).toEqual([
      'PTT',
      '55555555-5555-4555-8555-555555555555',
      42,
    ]);
  });

  it('returns 404 when a scoped video version is missing', async () => {
    const videos = new CpVideosService(new ScopedVersionQuery(false));

    await expect(videos.getVersion(
      '55555555-5555-4555-8555-555555555555',
      { scope: 'all', staffId: 42 },
    )).rejects.toMatchObject({ status: 404 });
  });

  it('invalidates a prior approval when the draft is patched', async () => {
    const draftId = '44444444-4444-4444-8444-444444444444';
    const versionId = '55555555-5555-4555-8555-555555555555';
    const draft = {
      id: draftId,
      name: 'Draft',
      input_mode: 'prompt',
      prompt: 'old',
      script_json: null,
      config_json: {},
      brand_kit_version_id: null,
    };
    const version = {
      id: versionId,
      draft_id: draftId,
      approval_status: 'brand_approved',
      version_n: 2,
    };
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      async query(sql: string, params: unknown[] = []) {
        calls.push({ sql, params });
        if (sql.includes('UPDATE crm_cp_video_drafts')) {
          return { rows: [{ ...draft, name: params[1], revision: 2 }] };
        }
        if (sql.includes('UPDATE crm_cp_video_versions')) {
          version.approval_status = String(params[1]);
          return { rows: [version] };
        }
        if (sql.includes('crm_cp_video_versions')) {
          return { rows: [version] };
        }
        return { rows: [draft] };
      },
    };
    const audit = { insert: jest.fn().mockResolvedValue(undefined) };
    const videos = new CpVideosService(db, audit as never);

    await videos.patch(draftId, { name: 'Edited after approve' }, { scope: 'all', staffId: 9 });

    expect(version.approval_status).toBe('internal_review');
    expect(calls.some((call) => (
      call.sql.includes('UPDATE crm_cp_video_versions')
      && call.sql.includes('approval_status')
    ))).toBe(true);
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      actor_id: 9,
      action: 'approval_invalidated',
      resource_type: 'video_version',
      resource_id: versionId,
    }));
  });

  it('does not invalidate when the latest version is still internal_review', async () => {
    const draftId = '44444444-4444-4444-8444-444444444444';
    const draft = {
      id: draftId,
      name: 'Draft',
      input_mode: 'prompt',
      prompt: 'old',
      script_json: null,
      config_json: {},
      brand_kit_version_id: null,
    };
    const audit = { insert: jest.fn() };
    const db = {
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes('UPDATE crm_cp_video_drafts')) {
          return { rows: [{ ...draft, name: params[1] }] };
        }
        if (sql.includes('crm_cp_video_versions')) {
          return { rows: [{ id: '55555555-5555-4555-8555-555555555555', approval_status: 'internal_review' }] };
        }
        return { rows: [draft] };
      },
    };
    const videos = new CpVideosService(db, audit as never);

    await videos.patch(draftId, { name: 'Still drafting' }, { scope: 'all', staffId: 9 });

    expect(audit.insert).not.toHaveBeenCalled();
  });
});
