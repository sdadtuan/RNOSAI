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
});
