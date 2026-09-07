import { CpVideosService } from './cp-videos.service';

const DRAFT_ID = '44444444-4444-4444-8444-444444444444';
const VERSION_ID = '55555555-5555-4555-8555-555555555555';
const PROJECT_ID = '66666666-6666-4666-8666-666666666666';
const SCOPE = { scope: 'all' as const, staffId: 9, teamIds: [] };

class LocaleQuery {
  draft: Record<string, unknown>;
  versions: Record<string, unknown>[];
  calls: Array<{ sql: string; params: unknown[] }> = [];

  constructor(opts: { completed?: boolean } = {}) {
    this.draft = {
      id: DRAFT_ID,
      project_id: PROJECT_ID,
      name: 'Draft',
      input_mode: 'prompt',
      prompt: 'hello',
      script_json: null,
      config_json: { language: 'vi' },
      brand_kit_version_id: null,
    };
    this.versions = opts.completed
      ? [{
        id: VERSION_ID,
        draft_id: DRAFT_ID,
        immutable: true,
        snapshot_json: { draft: { config_json: { language: 'vi' } } },
      }]
      : [];
  }

  async query(sql: string, params: unknown[] = []) {
    this.calls.push({ sql, params });
    if (sql.includes('INSERT INTO crm_cp_video_drafts')) {
      this.draft = {
        ...this.draft,
        id: DRAFT_ID,
        project_id: params[0],
        name: params[3],
        config_json: typeof params[7] === 'string' ? JSON.parse(String(params[7])) : params[7],
      };
      return { rows: [{ ...this.draft }] };
    }
    if (sql.includes('UPDATE crm_cp_video_drafts')) {
      this.draft = {
        ...this.draft,
        name: params[1] ?? this.draft.name,
        config_json: typeof params[5] === 'string' ? JSON.parse(String(params[5])) : params[5] ?? this.draft.config_json,
      };
      return { rows: [{ ...this.draft }] };
    }
    if (sql.includes('UPDATE crm_cp_video_versions') && sql.includes('snapshot_json')) {
      const version = this.versions[0];
      if (version) version.snapshot_json = params[1];
      return { rows: version ? [version] : [] };
    }
    if (sql.includes('FROM crm_cp_video_versions')) {
      return { rows: this.versions };
    }
    if (sql.includes('FROM crm_cp_projects')) {
      return { rows: [{ id: PROJECT_ID, agency_client_id: '77777777-7777-4777-8777-777777777777' }] };
    }
    return { rows: [{ ...this.draft }] };
  }
}

describe('draft locale / language', () => {
  it('writes config_json.language on a new draft', async () => {
    const db = new LocaleQuery();
    const videos = new CpVideosService(db);

    const created = await videos.upsertDraft({
      project_id: PROJECT_ID,
      name: 'Locale draft',
      config_json: { language: 'en' },
    }, SCOPE);

    expect((created.config_json as { language?: string }).language).toBe('en');
  });

  it('allows language change on an unrendered draft', async () => {
    const db = new LocaleQuery();
    const videos = new CpVideosService(db);

    const patched = await videos.patchDraft(DRAFT_ID, {
      config_json: { language: 'en' },
    }, SCOPE);

    expect((patched.config_json as { language?: string }).language).toBe('en');
  });

  it('does not rewrite draft language after a completed version exists', async () => {
    const db = new LocaleQuery({ completed: true });
    const videos = new CpVideosService(db);

    const patched = await videos.patchDraft(DRAFT_ID, {
      config_json: { language: 'en', style: 'bold' },
    }, SCOPE);

    expect((patched.config_json as { language?: string }).language).toBe('vi');
    expect((db.versions[0].snapshot_json as { draft: { config_json: { language: string } } }).draft.config_json.language).toBe('vi');
    expect(db.calls.some((call) => (
      call.sql.includes('UPDATE crm_cp_video_versions')
      && call.sql.includes('snapshot_json')
    ))).toBe(false);
  });
});
