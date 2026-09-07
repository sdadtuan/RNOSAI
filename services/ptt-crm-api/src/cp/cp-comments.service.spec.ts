import { CpCommentsService } from './cp-comments.service';

const VERSION_ID = '55555555-5555-4555-8555-555555555555';
const SCOPE = { scope: 'all' as const, staffId: 9 };

class VersionPort {
  async getVersion(id: string) {
    if (id !== VERSION_ID) throw Object.assign(new Error('not_found'), { status: 404 });
    return { id: VERSION_ID, draft_id: '44444444-4444-4444-8444-444444444444' };
  }
}

class CommentQuery {
  rows: Record<string, unknown>[] = [];
  lastSql = '';
  lastParams: unknown[] = [];

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    this.lastParams = params;
    if (sql.includes('INSERT INTO crm_cp_comments')) {
      const row = {
        id: '66666666-6666-4666-8666-666666666666',
        object_type: params[0],
        object_id: params[1],
        timecode_ms: params[2],
        body: params[3],
        status: params[4],
        mention_ids: params[5],
        created_by: params[6],
      };
      this.rows.push(row);
      return { rows: [row] };
    }
    if (sql.includes('FROM crm_cp_comments')) {
      return { rows: this.rows.filter((row) => row.object_id === params[0]) };
    }
    return { rows: [] };
  }
}

describe('CpCommentsService', () => {
  it('creates a timecode comment on a video version and lists it', async () => {
    const db = new CommentQuery();
    const comments = new CpCommentsService(new VersionPort() as never, db);

    const created = await comments.create(
      VERSION_ID,
      { body: 'Logo tràn safe area', timecode_ms: 1250, mention_ids: [3] },
      9,
      SCOPE,
    );

    expect(created).toMatchObject({
      object_type: 'video_version',
      object_id: VERSION_ID,
      body: 'Logo tràn safe area',
      timecode_ms: 1250,
      status: 'open',
      created_by: 9,
    });
    expect(db.lastSql).toContain('INSERT INTO crm_cp_comments');

    const listed = await comments.list(VERSION_ID, SCOPE);
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0].body).toBe('Logo tràn safe area');
  });

  it('rejects an empty comment body', async () => {
    const comments = new CpCommentsService(new VersionPort() as never, new CommentQuery());

    await expect(
      comments.create(VERSION_ID, { body: '  ' }, 9, SCOPE),
    ).rejects.toMatchObject({ status: 400, error: 'body_required' });
  });
});
