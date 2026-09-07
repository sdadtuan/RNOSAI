import {
  assertChannelProfile,
  assertSchedulable,
  CpPublishService,
  fileExportPostRef,
  nativePublishEnabled,
  spreadBulkSlots,
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

const ITEM_ID = '77777777-7777-4777-8777-777777777777';
const VERSION_B = '55555555-5555-4555-8555-555555555556';

class PublishQuery {
  lastSql = '';
  lastParams: unknown[] = [];
  profiles = [TIKTOK];
  assetVersions: Array<{ id: string; asset_id: string }> = [];
  rights: Array<{ asset_id: string; expiry_on: string | null }> = [];
  rules: Array<{ enforcement: string; action_json: unknown }> = [];
  inserted: Record<string, unknown> | null = null;
  insertedItems: Record<string, unknown>[] = [];
  updated: Record<string, unknown> | null = null;
  queriedAssetIds: unknown[] = [];
  queriedVersionIds: unknown[] = [];
  versions: Record<string, unknown>[] = [];
  items: Record<string, unknown>[] = [];
  batchItems: Array<{
    id: string;
    video_version_id?: string;
    row_json?: Record<string, unknown>;
    outOfScope?: boolean;
  }> = [];
  activity: Record<string, unknown>[] = [];
  batchResolveSql = '';
  batchResolveParams: unknown[] = [];

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
        id: `${ITEM_ID.slice(0, -1)}${this.insertedItems.length}`,
        video_version_id: params[0],
        channel: params[1],
        profile_id: params[2],
        scheduled_at: params[3],
        tz: params[4],
        copy: params[5],
        hashtags: params[6],
        status: params[11],
        post_ref: null,
        last_error: null,
      };
      this.insertedItems.push(this.inserted);
      return { rows: [this.inserted] };
    }
    if (sql.includes('UPDATE crm_cp_publish_items')) {
      const current = this.items[0] ?? { id: params[params.length - 1] };
      this.updated = {
        ...current,
        status: params[0],
        post_ref: params[1],
        last_error: params[2],
      };
      return { rows: [this.updated] };
    }
    if (sql.includes('FROM crm_cp_publish_items')) {
      if (sql.includes('i.id =')) {
        const id = String(params[0]);
        return { rows: this.items.filter((row) => String(row.id) === id) };
      }
      return { rows: this.items };
    }
    if (sql.includes('FROM crm_cp_batch_items')) {
      this.batchResolveSql = sql;
      this.batchResolveParams = params;
      const scoped = /crm_cp_batch_jobs/.test(sql) && /tenant_id/.test(sql);
      const ids = new Set((Array.isArray(params[0]) ? params[0] : [params[0]]).map(String));
      return {
        rows: this.batchItems.filter((row) => {
          if (!ids.has(row.id)) return false;
          if (row.outOfScope && scoped) return false;
          return true;
        }),
      };
    }
    if (sql.includes('FROM crm_cp_activity')) {
      return { rows: this.activity };
    }
    if (sql.includes('FROM crm_cp_video_versions')) {
      return { rows: this.versions };
    }
    return { rows: [] };
  }
}

class SettingsPort {
  publish_native: boolean | null = false;
  async get() {
    return { publish_native: this.publish_native };
  }
}

class AuditPort {
  rows: Array<Record<string, unknown>> = [];
  async insert(input: Record<string, unknown>) {
    this.rows.push(input);
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

describe('nativePublishEnabled / file-export ref', () => {
  const previousNative = process.env.CP_PUBLISH_NATIVE;

  afterEach(() => {
    if (previousNative === undefined) delete process.env.CP_PUBLISH_NATIVE;
    else process.env.CP_PUBLISH_NATIVE = previousNative;
  });

  it('is false when settings and CP_PUBLISH_NATIVE are unset or false', () => {
    delete process.env.CP_PUBLISH_NATIVE;
    expect(nativePublishEnabled(false)).toBe(false);
    expect(nativePublishEnabled(null)).toBe(false);
    expect(nativePublishEnabled(undefined)).toBe(false);
  });

  it('never returns a TikTok or Reels URL for file-export post_ref', () => {
    expect(fileExportPostRef(ITEM_ID)).toBe(`export:${ITEM_ID}`);
    expect(fileExportPostRef(ITEM_ID)).not.toMatch(/tiktok|reels|instagram/i);
  });
});

describe('spreadBulkSlots', () => {
  it('spreads n_per_day across windows and weekdays in Asia/Ho_Chi_Minh', () => {
    const slots = spreadBulkSlots(3, {
      n_per_day: 2,
      windows: [{ start: '09:00', end: '11:00' }],
      weekdays: [1],
    }, 'Asia/Ho_Chi_Minh', new Date('2026-09-07T00:00:00+07:00'));

    expect(slots).toHaveLength(3);
    expect(slots[0]).toBe('2026-09-07T02:00:00.000Z');
    expect(slots[1]).toBe('2026-09-07T03:00:00.000Z');
    expect(slots[2]).toBe('2026-09-14T02:00:00.000Z');
  });

  it('skips elapsed same-day windows when from is after 11:00 ICT', () => {
    const slots = spreadBulkSlots(2, {
      n_per_day: 1,
      windows: [{ start: '09:00', end: '11:00' }],
      weekdays: [1, 2, 3, 4, 5],
    }, 'Asia/Ho_Chi_Minh', new Date('2026-09-07T11:01:00+07:00'));

    expect(slots).toHaveLength(2);
    expect(slots[0]).toBe('2026-09-08T02:00:00.000Z');
    expect(slots[1]).toBe('2026-09-09T02:00:00.000Z');
    expect(new Date(slots[0]).getTime()).toBeGreaterThan(
      new Date('2026-09-07T11:01:00+07:00').getTime(),
    );
  });
});

describe('CpPublishService deliver / retry / bulk', () => {
  it('deliver re-runs the publish gate and 409s expired rights instead of publishing', async () => {
    const videos = new VersionPort();
    videos.version = finalVersion({
      snapshot_json: {
        config_json: { ratio: '9:16', duration: 30 },
        disclaimer_present: true,
        asset_versions: [{ id: ASSET_VERSION_ID }],
      },
    });
    const db = new PublishQuery();
    db.items = [{
      id: ITEM_ID,
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      status: 'scheduled',
      post_ref: null,
      last_error: null,
    }];
    db.assetVersions = [{ id: ASSET_VERSION_ID, asset_id: PARENT_ASSET_ID }];
    db.rights = [{ asset_id: PARENT_ASSET_ID, expiry_on: '2020-01-01' }];
    const settings = new SettingsPort();
    const svc = new CpPublishService(videos as never, db, undefined, settings as never);

    await expect(svc.deliver(ITEM_ID, SCOPE)).rejects.toMatchObject({
      status: 409,
      error: 'rights_blocked',
    });
    expect(db.updated).toBeNull();
  });

  it('deliver marks published + export post_ref on file-export success', async () => {
    const videos = new VersionPort();
    const db = new PublishQuery();
    db.items = [{
      id: ITEM_ID,
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      status: 'scheduled',
      post_ref: null,
      last_error: null,
    }];
    const settings = new SettingsPort();
    const svc = new CpPublishService(videos as never, db, undefined, settings as never);

    const row = await svc.deliver(ITEM_ID, SCOPE);
    expect(row).toMatchObject({
      status: 'published',
      post_ref: `export:${ITEM_ID}`,
      last_error: null,
      kind: 'video',
    });
    expect(String(row.post_ref)).not.toMatch(/tiktok\.com|instagram|reels/i);
  });

  it('deliver marks failed + last_error when the handoff cannot load the version', async () => {
    const videos = new VersionPort();
    const db = new PublishQuery();
    db.items = [{
      id: ITEM_ID,
      video_version_id: VERSION_B,
      channel: 'tiktok',
      status: 'scheduled',
    }];
    const svc = new CpPublishService(videos as never, db);

    const row = await svc.deliver(ITEM_ID, SCOPE);
    expect(row).toMatchObject({
      status: 'failed',
      post_ref: null,
    });
    expect(String(row.last_error)).toBeTruthy();
  });

  it('retry writes an audit row then retries the same file-export handoff', async () => {
    const videos = new VersionPort();
    const db = new PublishQuery();
    db.items = [{
      id: ITEM_ID,
      video_version_id: VERSION_ID,
      channel: 'tiktok',
      status: 'failed',
      last_error: 'handoff_failed',
    }];
    const audit = new AuditPort();
    const settings = new SettingsPort();
    const svc = new CpPublishService(videos as never, db, audit as never, settings as never);

    const row = await svc.retry(ITEM_ID, SCOPE);
    expect(audit.rows).toEqual([
      expect.objectContaining({
        actor_id: 9,
        action: 'publish.retry',
        resource_type: 'publish_item',
        resource_id: ITEM_ID,
      }),
    ]);
    expect(row).toMatchObject({
      status: 'published',
      post_ref: `export:${ITEM_ID}`,
    });
  });

  it('bulk skips unschedulable versions and writes N items + N audit rows', async () => {
    const videos = new VersionPort();
    videos.version = finalVersion();
    const db = new PublishQuery();
    const audit = new AuditPort();
    const getVersion = jest.fn(async (id: string) => {
      if (id === VERSION_B) return finalVersion({ id: VERSION_B, approval_status: 'client_review' });
      return finalVersion();
    });
    const svc = new CpPublishService({ getVersion } as never, db, audit as never);

    const out = await svc.bulkSchedule({
      video_version_ids: [VERSION_ID, VERSION_B],
      channel: 'tiktok',
      tz: 'Asia/Ho_Chi_Minh',
      rule: {
        n_per_day: 1,
        windows: [{ start: '09:00', end: '10:00' }],
        weekdays: [1, 2, 3, 4, 5],
      },
    }, SCOPE);

    expect(out.items).toHaveLength(1);
    expect(out.skipped).toEqual([
      expect.objectContaining({ video_version_id: VERSION_B, reason: 'not_final_approved' }),
    ]);
    expect(db.insertedItems).toHaveLength(1);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      action: 'publish.schedule',
      resource_type: 'publish_item',
    });
  });

  it('bulk resolves batch item ids to versions', async () => {
    const db = new PublishQuery();
    db.batchItems = [{
      id: '88888888-8888-4888-8888-888888888888',
      row_json: { video_version_id: VERSION_ID },
    }];
    const audit = new AuditPort();
    const svc = new CpPublishService(new VersionPort() as never, db, audit as never);

    const out = await svc.bulkSchedule({
      batch_item_ids: ['88888888-8888-4888-8888-888888888888'],
      channel: 'tiktok',
      rule: { n_per_day: 1, windows: [{ start: '09:00', end: '10:00' }], weekdays: [1] },
    }, SCOPE);

    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ video_version_id: VERSION_ID, status: 'scheduled' });
    expect(db.batchResolveSql).toMatch(/crm_cp_batch_jobs/);
    expect(db.batchResolveSql).toMatch(/tenant_id/);
  });

  it('bulk from after 11:00 ICT schedules the first item on the next weekday window', async () => {
    const db = new PublishQuery();
    const audit = new AuditPort();
    const svc = new CpPublishService(new VersionPort() as never, db, audit as never);

    const out = await svc.bulkSchedule({
      video_version_ids: [VERSION_ID],
      channel: 'tiktok',
      tz: 'Asia/Ho_Chi_Minh',
      from: '2026-09-07T11:01:00+07:00',
      rule: {
        n_per_day: 1,
        windows: [{ start: '09:00', end: '11:00' }],
        weekdays: [1, 2, 3, 4, 5],
      },
    }, SCOPE);

    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({
      status: 'scheduled',
      scheduled_at: '2026-09-08T02:00:00.000Z',
    });
  });

  it('does not resolve an out-of-scope batch_item_id to a video_version_id', async () => {
    const db = new PublishQuery();
    db.batchItems = [{
      id: '88888888-8888-4888-8888-888888888888',
      outOfScope: true,
      row_json: { video_version_id: VERSION_ID },
    }];
    const audit = new AuditPort();
    const svc = new CpPublishService(new VersionPort() as never, db, audit as never);
    const meScope = { scope: 'me' as const, staffId: 9, teamIds: [] };

    const out = await svc.bulkSchedule({
      batch_item_ids: ['88888888-8888-4888-8888-888888888888'],
      channel: 'tiktok',
      from: '2026-09-08T08:00:00+07:00',
      rule: { n_per_day: 1, windows: [{ start: '09:00', end: '10:00' }], weekdays: [1, 2] },
    }, meScope);

    expect(out.items).toHaveLength(0);
    expect(db.insertedItems).toHaveLength(0);
    expect(db.batchResolveSql).toMatch(/crm_cp_batch_jobs/);
    expect(db.batchResolveSql).toMatch(/tenant_id/);
    expect(db.batchResolveParams).toEqual(expect.arrayContaining([
      ['88888888-8888-4888-8888-888888888888'],
      'PTT',
      9,
    ]));
  });
});
