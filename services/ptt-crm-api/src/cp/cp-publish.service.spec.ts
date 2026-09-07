import {
  assertChannelProfile,
  assertSchedulable,
  CpPublishService,
} from './cp-publish.service';

const VERSION_ID = '55555555-5555-4555-8555-555555555555';
const PROFILE_ID = '66666666-6666-4666-8666-666666666666';
const SCOPE = { scope: 'all' as const, staffId: 9, teamIds: [] };

const TIKTOK = {
  id: PROFILE_ID,
  channel: 'tiktok',
  rules_json: { ratio: ['9:16'], duration_sec: [15, 60], caption_max: 2200 },
};

function finalVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_ID,
    draft_id: '44444444-4444-4444-8444-444444444444',
    approval_status: 'final_approved',
    qc_status: 'passed',
    brand_kit_version_id: null,
    snapshot_json: {
      config_json: { ratio: '9:16', duration: 30 },
      disclaimer_present: true,
    },
    ...overrides,
  };
}

class VersionPort {
  version: Record<string, unknown> = finalVersion();

  async getVersion(id: string) {
    if (id !== VERSION_ID) throw Object.assign(new Error('not_found'), { status: 404 });
    return this.version;
  }
}

const ASSET_VERSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PARENT_ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

class PublishQuery {
  lastSql = '';
  lastParams: unknown[] = [];
  profiles = [TIKTOK];
  assetVersions: Array<{ id: string; asset_id: string }> = [];
  rights: Array<{ asset_id: string; expiry_on: string | null }> = [];
  rules: Array<{ enforcement: string; action_json: unknown }> = [];
  inserted: Record<string, unknown> | null = null;
  queriedAssetIds: unknown[] = [];
  queriedVersionIds: unknown[] = [];
  versions: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    this.lastParams = params;
    if (sql.includes('FROM crm_cp_channel_profiles')) {
      if (sql.includes('WHERE channel')) {
        return { rows: this.profiles.filter((row) => row.channel === params[0]) };
      }
      return { rows: this.profiles };
    }
    if (sql.includes('FROM crm_cp_asset_versions')) {
      this.queriedVersionIds = Array.isArray(params[0]) ? params[0] : [params[0]];
      const ids = new Set(this.queriedVersionIds.map((id) => String(id)));
      return { rows: this.assetVersions.filter((row) => ids.has(row.id)) };
    }
    if (sql.includes('FROM crm_cp_asset_rights')) {
      this.queriedAssetIds = Array.isArray(params[0]) ? params[0] : [params[0]];
      const ids = new Set(this.queriedAssetIds.map((id) => String(id)));
      return { rows: this.rights.filter((row) => ids.has(row.asset_id)) };
    }
    if (sql.includes('FROM crm_cp_brand_rules')) {
      return { rows: this.rules };
    }
    if (sql.includes('INSERT INTO crm_cp_publish_items')) {
      this.inserted = {
        id: '77777777-7777-4777-8777-777777777777',
        video_version_id: params[0],
        channel: params[1],
        profile_id: params[2],
        scheduled_at: params[3],
        tz: params[4],
        copy: params[5],
        hashtags: params[6],
        status: params[11],
      };
      return { rows: [this.inserted] };
    }
    if (sql.includes('FROM crm_cp_publish_items')) {
      return { rows: [] };
    }
    if (sql.includes('FROM crm_cp_video_versions')) {
      return { rows: this.versions };
    }
    return { rows: [] };
  }
}

describe('assertSchedulable', () => {
  it('rejects a client_review version with 409 not_final_approved', () => {
    expect(() => assertSchedulable(finalVersion({ approval_status: 'client_review' }))).toThrow(
      expect.objectContaining({ status: 409, error: 'not_final_approved' }),
    );
  });

  it('accepts a final_approved version with QC passed', () => {
    expect(() => assertSchedulable(finalVersion({
      approval_status: 'final_approved',
      qc_status: 'passed',
    }))).not.toThrow();
  });

  it('rejects qc_status blocked with 409 qc_blocked', () => {
    expect(() => assertSchedulable(finalVersion({ qc_status: 'blocked' }))).toThrow(
      expect.objectContaining({ status: 409, error: 'qc_blocked' }),
    );
  });

  it('rejects when any used asset rights status is block', () => {
    expect(() => assertSchedulable(finalVersion(), { rightsStatuses: ['ok', 'block'] })).toThrow(
      expect.objectContaining({ status: 409, error: 'rights_blocked' }),
    );
  });

  it('rejects missing mandatory disclaimer from a block_publish kit rule', () => {
    expect(() => assertSchedulable(finalVersion({ snapshot_json: {} }), {
      kitRules: [{ enforcement: 'block_publish', action_json: { disclaimer: true } }],
      disclaimerPresent: false,
    })).toThrow(expect.objectContaining({ status: 409, error: 'disclaimer_required' }));
  });
});

describe('assertChannelProfile', () => {
  const rules = TIKTOK.rules_json;

  it('rejects ratio, duration, and caption that miss the seeded tiktok profile', () => {
    expect(() => assertChannelProfile(rules, { ratio: '1:1', duration_sec: 30, caption: 'ok' })).toThrow(
      expect.objectContaining({ status: 409, error: 'channel_profile' }),
    );
    expect(() => assertChannelProfile(rules, { ratio: '9:16', duration_sec: 10, caption: 'ok' })).toThrow(
      expect.objectContaining({ status: 409, error: 'channel_profile' }),
    );
    expect(() => assertChannelProfile(rules, {
      ratio: '9:16',
      duration_sec: 30,
      caption: 'x'.repeat(2201),
    })).toThrow(expect.objectContaining({ status: 409, error: 'channel_profile' }));
  });

  it('accepts tiktok 9:16 within 15-60s and caption under 2200', () => {
    expect(() => assertChannelProfile(rules, {
      ratio: '9:16',
      duration_sec: 30,
      caption: 'Sống trên mây',
    })).not.toThrow();
  });
});

describe('CpPublishService', () => {
  it('schedule rejects client_review before insert', async () => {
    const videos = new VersionPort();
    videos.version = finalVersion({ approval_status: 'client_review' });
    const db = new PublishQuery();
    const svc = new CpPublishService(videos as never, db);

    await expect(svc.schedule({
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      scheduled_at: '2026-09-15T09:00:00+07:00',
      copy: 'ok',
    }, SCOPE)).rejects.toMatchObject({ status: 409, error: 'not_final_approved' });
    expect(db.inserted).toBeNull();
  });

  it('schedule accepts final_approved + qc passed and inserts a video PublishItem', async () => {
    const videos = new VersionPort();
    const db = new PublishQuery();
    const svc = new CpPublishService(videos as never, db);

    const row = await svc.schedule({
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      scheduled_at: '2026-09-15T09:00:00+07:00',
      copy: 'Sống trên mây',
    }, SCOPE);

    expect(row).toMatchObject({
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      status: 'scheduled',
    });
    expect(db.lastSql).toContain('INSERT INTO crm_cp_publish_items');
  });

  it('resolves snapshot version ids to parent asset rights and 409s when expired/block', async () => {
    const videos = new VersionPort();
    videos.version = finalVersion({
      snapshot_json: {
        config_json: { ratio: '9:16', duration: 30 },
        disclaimer_present: true,
        asset_versions: [{ id: ASSET_VERSION_ID }],
      },
    });
    const db = new PublishQuery();
    db.assetVersions = [{ id: ASSET_VERSION_ID, asset_id: PARENT_ASSET_ID }];
    db.rights = [{ asset_id: PARENT_ASSET_ID, expiry_on: '2020-01-01' }];
    const svc = new CpPublishService(videos as never, db);

    await expect(svc.schedule({
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      scheduled_at: '2026-09-15T09:00:00+07:00',
      copy: 'ok',
    }, SCOPE)).rejects.toMatchObject({ status: 409, error: 'rights_blocked' });
    expect(db.queriedVersionIds).toContain(ASSET_VERSION_ID);
    expect(db.queriedAssetIds).toContain(PARENT_ASSET_ID);
    expect(db.inserted).toBeNull();
  });

  it('interprets naive scheduled_at in the selected tz', async () => {
    const videos = new VersionPort();
    const db = new PublishQuery();
    const svc = new CpPublishService(videos as never, db);

    const row = await svc.schedule({
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      scheduled_at: '2026-09-15T09:00',
      tz: 'Asia/Ho_Chi_Minh',
      copy: 'ok',
    }, SCOPE);

    expect(row).toMatchObject({
      scheduled_at: '2026-09-15T02:00:00.000Z',
      tz: 'Asia/Ho_Chi_Minh',
    });
  });

  it('listVersions sets schedulable false when version ids resolve to blocked rights', async () => {
    const db = new PublishQuery();
    db.versions = [finalVersion({
      snapshot_json: {
        config_json: { ratio: '9:16', duration: 30 },
        disclaimer_present: true,
        asset_versions: [{ id: ASSET_VERSION_ID }],
      },
    })];
    db.assetVersions = [{ id: ASSET_VERSION_ID, asset_id: PARENT_ASSET_ID }];
    db.rights = [{ asset_id: PARENT_ASSET_ID, expiry_on: '2020-01-01' }];
    const svc = new CpPublishService(new VersionPort() as never, db);

    const out = await svc.listVersions(SCOPE);
    expect(out.items[0]).toMatchObject({
      schedulable: false,
      eligible: false,
      lock_reason: 'rights_blocked',
    });
  });
});
