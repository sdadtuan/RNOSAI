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
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 9,
        action: 'approval_invalidated',
        resource_type: 'video_version',
        resource_id: versionId,
      }),
      expect.objectContaining({ query: expect.any(Function) }),
    );
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

const DRAFT_ID = '44444444-4444-4444-8444-444444444444';
const SCENE_SCOPE = { scope: 'all' as const, staffId: 9 };

function sceneDraft() {
  return {
    id: DRAFT_ID,
    name: 'Draft',
    input_mode: 'prompt',
    prompt: 'old',
    script_json: null,
    config_json: {},
    brand_kit_version_id: null,
    revision: 1,
  };
}

function lockedScene(overrides: Record<string, unknown> = {}) {
  return {
    draft_id: DRAFT_ID,
    idx: 0,
    title: 'Hook',
    t_start: 0,
    t_end: 3,
    visual: 'locked visual',
    vo: 'locked vo',
    overlay: 'LOCKED OVERLAY',
    locked: true,
    qc: null,
    ...overrides,
  };
}

class SceneQuery {
  draft = sceneDraft();
  scenes: Record<string, unknown>[] = [lockedScene()];
  calls: Array<{ sql: string; params: unknown[] }> = [];

  async query(sql: string, params: unknown[] = []) {
    this.calls.push({ sql, params });
    if (sql.includes('UPDATE crm_cp_video_drafts') && sql.includes('revision')) {
      this.draft.revision = Number(this.draft.revision) + 1;
      this.draft.config_json = typeof params[1] === 'string'
        ? JSON.parse(params[1] as string)
        : params[1] ?? this.draft.config_json;
      return { rows: [{ ...this.draft }] };
    }
    if (sql.includes('DELETE FROM crm_cp_scenes')) {
      this.scenes = this.scenes.filter((row) => row.draft_id !== params[0]);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO crm_cp_scenes')) {
      const row = {
        draft_id: params[0],
        idx: params[1],
        title: params[2],
        t_start: params[3],
        t_end: params[4],
        visual: params[5],
        vo: params[6],
        overlay: params[7],
        locked: params[8],
        qc: params[9],
      };
      this.scenes.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE crm_cp_scenes')) {
      const scene = this.scenes.find((row) => row.draft_id === params[0] && row.idx === params[1]);
      if (!scene) return { rows: [] };
      if (sql.includes('t_start')) {
        scene.t_start = params[2];
        scene.t_end = params[3];
      }
      if (sql.includes('visual')) {
        scene.visual = params[2];
        scene.vo = params[3];
        scene.overlay = params[4];
      }
      return { rows: [{ ...scene }] };
    }
    if (sql.includes('crm_cp_scenes')) {
      if (params.length >= 2 && (sql.includes('idx') || sql.includes('AND'))) {
        return { rows: this.scenes.filter((row) => row.draft_id === params[0] && row.idx === params[1]) };
      }
      return { rows: this.scenes.filter((row) => row.draft_id === params[0]).sort((a, b) => Number(a.idx) - Number(b.idx)) };
    }
    return { rows: [{ ...this.draft }] };
  }
}

describe('CpVideosService scenes and timeline', () => {
  it('replaces draft scenes through putScenes and lists them', async () => {
    const db = new SceneQuery();
    const videos = new CpVideosService(db);

    const saved = await videos.putScenes(DRAFT_ID, {
      scenes: [
        { idx: 0, title: 'Open', t_start: 0, t_end: 2, visual: 'A', vo: 'Hi', overlay: 'HELLO', locked: false },
        { idx: 1, title: 'Close', t_start: 2, t_end: 4, visual: 'B', vo: 'Bye', overlay: 'END', locked: false },
      ],
    }, SCENE_SCOPE);

    expect(saved.items).toHaveLength(2);
    expect(saved.items[1]).toMatchObject({ idx: 1, title: 'Close', overlay: 'END' });
    expect(db.calls.some((call) => call.sql.includes('DELETE FROM crm_cp_scenes'))).toBe(true);
    expect(db.calls.some((call) => call.sql.includes('INSERT INTO crm_cp_scenes'))).toBe(true);

    const listed = await videos.listScenes(DRAFT_ID, SCENE_SCOPE);
    expect(listed.items).toHaveLength(2);
    expect(listed.items[0].title).toBe('Open');
  });

  it('increments draft revision when the timeline is patched', async () => {
    const db = new SceneQuery();
    db.scenes = [lockedScene({ locked: false, overlay: 'Hello' })];
    const videos = new CpVideosService(db);

    const result = await videos.patchTimeline(DRAFT_ID, {
      scenes: [{ idx: 0, t_start: 1, t_end: 5 }],
      music: { source: 'bed-a', t_start: 0, t_end: 15 },
    }, SCENE_SCOPE);

    expect(result.revision).toBe(2);
    expect(result.scenes[0]).toMatchObject({ idx: 0, t_start: 1, t_end: 5 });
    expect(db.calls.some((call) => (
      call.sql.includes('UPDATE crm_cp_video_drafts')
      && call.sql.includes('revision = revision + 1')
    ))).toBe(true);
  });

  it('regenerate does not change locked overlay', async () => {
    const db = new SceneQuery();
    const videos = new CpVideosService(db);

    const result = await videos.regenerateScene(DRAFT_ID, 0, SCENE_SCOPE);

    expect(result.overlay).toBe('LOCKED OVERLAY');
    expect(result.vo).toBe('locked vo');
    expect(result.visual).toBe('locked visual');
    expect(db.calls.some((call) => (
      call.sql.includes('UPDATE crm_cp_scenes') && call.sql.includes('overlay')
    ))).toBe(false);
  });

  it('regenerate updates overlay vo and visual when the scene is unlocked', async () => {
    const db = new SceneQuery();
    db.scenes = [lockedScene({ locked: false })];
    const videos = new CpVideosService(db);

    const result = await videos.regenerateScene(DRAFT_ID, 0, SCENE_SCOPE);

    expect(result.overlay).not.toBe('LOCKED OVERLAY');
    expect(result.vo).not.toBe('locked vo');
    expect(result.visual).not.toBe('locked visual');
    expect(result.overlay).toBeTruthy();
    expect(result.vo).toBeTruthy();
    expect(result.visual).toBeTruthy();
  });
});
