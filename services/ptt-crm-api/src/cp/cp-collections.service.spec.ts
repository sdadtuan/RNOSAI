import { assetScope } from './cp-assets.service';
import {
  CP_SMART_FILTER_KEYS,
  CpCollectionsService,
  parseSmartFilter,
} from './cp-collections.service';

const COLLECTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SMART_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ASSET_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ASSET_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PROJECT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CLIENT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const STAFF_A = { scope: 'me' as const, staffId: 11, teamIds: [] };
const STAFF_B = { scope: 'me' as const, staffId: 22, teamIds: [] };

function assetRow(id: string, owner: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    tenant_id: 'PTT',
    agency_client_id: CLIENT_ID,
    project_id: PROJECT_ID,
    owner_staff_id: owner,
    filename: extra.filename ?? 'hero.png',
    mime: extra.mime ?? 'image/png',
    state: extra.state ?? 'ready',
    bytes: extra.bytes ?? 12,
    hash: extra.hash ?? `hash-${id}`,
    ...extra,
  };
}

class CollectionQuery {
  collections: Record<string, unknown>[] = [];
  items: Array<{ collection_id: string; asset_id: string }> = [];
  assets: Record<string, unknown>[] = [];
  sqls: string[] = [];
  params: unknown[][] = [];

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    this.params.push(params);
    if (/INSERT INTO crm_cp_collections/i.test(sql)) {
      const row = {
        id: COLLECTION_ID,
        tenant_id: 'PTT',
        name: params[1],
        smart_filter_json:
          typeof params[2] === 'string' ? JSON.parse(String(params[2])) : params[2],
        created_by: params[3],
      };
      this.collections.push(row);
      return { rows: [row] };
    }
    if (/INSERT INTO crm_cp_collection_items/i.test(sql)) {
      const row = { collection_id: String(params[0]), asset_id: String(params[1]) };
      this.items.push(row);
      return { rows: [row] };
    }
    if (/DELETE FROM crm_cp_collection_items/i.test(sql)) {
      this.items = this.items.filter(
        (row) => !(row.collection_id === params[0] && row.asset_id === params[1]),
      );
      return { rows: [], rowCount: 1 };
    }
    if (/FROM crm_cp_collections/i.test(sql)) {
      let rows = [...this.collections];
      const idMatch = /c\.id\s*=\s*\$(\d+)/i.exec(sql);
      if (idMatch) {
        const id = String(params[Number(idMatch[1]) - 1] ?? '');
        rows = rows.filter((row) => String(row.id) === id);
      }
      const createdBy = /c\.created_by\s*=\s*\$(\d+)/i.exec(sql);
      if (createdBy) {
        const staffId = params[Number(createdBy[1]) - 1];
        rows = rows.filter((row) => Number(row.created_by) === Number(staffId));
      }
      return { rows };
    }
    if (/FROM crm_cp_assets/i.test(sql)) {
      const scoped = /a\.owner_staff_id\s*=\s*\$(\d+)/i.exec(sql);
      let rows = [...this.assets];
      if (scoped) {
        const staffId = params[Number(scoped[1]) - 1];
        rows = rows.filter((row) => Number(row.owner_staff_id) === Number(staffId));
      }
      if (/crm_cp_collection_items/i.test(sql)) {
        const collectionId = String(params[1] ?? params[0] ?? '');
        const allowed = new Set(
          this.items
            .filter((item) => item.collection_id === collectionId)
            .map((item) => item.asset_id),
        );
        rows = rows.filter((row) => allowed.has(String(row.id)));
      }
      if (/a\.id\s*=\s*\$/i.test(sql)) {
        const idParam = params.find((value) => String(value) === ASSET_A || String(value) === ASSET_B);
        rows = rows.filter((row) => String(row.id) === String(idParam ?? params[1]));
      }
      return { rows };
    }
    return { rows: [] };
  }
}

describe('parseSmartFilter', () => {
  it('keeps a closed allowlist of filter keys', () => {
    expect([...CP_SMART_FILTER_KEYS].sort()).toEqual(
      ['agency_client_id', 'mime', 'project_id', 'state', 'tag'].sort(),
    );
    expect(parseSmartFilter({ mime: 'image/', state: 'ready' })).toEqual({
      mime: 'image/',
      state: 'ready',
    });
  });

  it('rejects unknown keys so callers cannot inject SQL', () => {
    expect(() => parseSmartFilter({ mime: 'image/', extra: '1=1' })).toThrow(
      expect.objectContaining({ error: 'invalid_smart_filter' }),
    );
  });
});

describe('CpCollectionsService smart filter scope', () => {
  it('reuses assetScope() SQL so staff A cannot see staff B assets', async () => {
    const db = new CollectionQuery();
    db.collections.push({
      id: SMART_ID,
      tenant_id: 'PTT',
      name: 'Images',
      smart_filter_json: { mime: 'image/' },
      created_by: STAFF_A.staffId,
    });
    db.assets.push(assetRow(ASSET_A, STAFF_A.staffId), assetRow(ASSET_B, STAFF_B.staffId));
    const service = new CpCollectionsService(db as never);

    const result = await service.get(SMART_ID, STAFF_A);
    const assetSql = db.sqls.find((sql) => /FROM crm_cp_assets/i.test(sql)) ?? '';
    const bound = assetScope(STAFF_A, 2);

    expect(assetSql).toContain(bound.sql);
    expect(result.items.map((row) => String(row.id))).toEqual([ASSET_A]);
    expect(result.items.map((row) => String(row.id))).not.toContain(ASSET_B);
  });

  it('hides out-of-scope assets even when they are listed on a manual collection', async () => {
    const db = new CollectionQuery();
    db.collections.push({
      id: COLLECTION_ID,
      tenant_id: 'PTT',
      name: 'Manual',
      smart_filter_json: null,
      created_by: STAFF_A.staffId,
    });
    db.items.push(
      { collection_id: COLLECTION_ID, asset_id: ASSET_A },
      { collection_id: COLLECTION_ID, asset_id: ASSET_B },
    );
    db.assets.push(assetRow(ASSET_A, STAFF_A.staffId), assetRow(ASSET_B, STAFF_B.staffId));
    const service = new CpCollectionsService(db as never);

    const result = await service.get(COLLECTION_ID, STAFF_A);

    expect(result.items.map((row) => String(row.id))).toEqual([ASSET_A]);
  });
});

describe('CpCollectionsService manual items', () => {
  it('adds and removes only assets that are in scope', async () => {
    const db = new CollectionQuery();
    db.collections.push({
      id: COLLECTION_ID,
      tenant_id: 'PTT',
      name: 'Manual',
      smart_filter_json: null,
      created_by: STAFF_A.staffId,
    });
    db.assets.push(assetRow(ASSET_A, STAFF_A.staffId), assetRow(ASSET_B, STAFF_B.staffId));
    const service = new CpCollectionsService(db as never);

    await expect(service.addItem(COLLECTION_ID, { asset_id: ASSET_B }, STAFF_A)).rejects.toMatchObject({
      error: 'not_found',
    });
    await expect(service.addItem(COLLECTION_ID, { asset_id: ASSET_A }, STAFF_A)).resolves.toMatchObject({
      asset_id: ASSET_A,
    });
    expect(db.items).toEqual([{ collection_id: COLLECTION_ID, asset_id: ASSET_A }]);

    await service.removeItem(COLLECTION_ID, ASSET_A, STAFF_A);
    expect(db.items).toEqual([]);
  });
});

describe('CpCollectionsService owner scope', () => {
  it('lists and loads only collections created by the requesting staff when scope=me', async () => {
    const db = new CollectionQuery();
    db.collections.push(
      {
        id: COLLECTION_ID,
        tenant_id: 'PTT',
        name: 'Mine',
        smart_filter_json: null,
        created_by: STAFF_A.staffId,
      },
      {
        id: SMART_ID,
        tenant_id: 'PTT',
        name: 'Other book',
        smart_filter_json: { mime: 'image/' },
        created_by: STAFF_B.staffId,
      },
    );
    db.assets.push(assetRow(ASSET_A, STAFF_A.staffId));
    const service = new CpCollectionsService(db as never);

    const listed = await service.list(STAFF_A);
    expect(listed.items.map((row) => String(row.id))).toEqual([COLLECTION_ID]);
    expect(listed.items.map((row) => String(row.name))).not.toContain('Other book');

    await expect(service.get(SMART_ID, STAFF_A)).rejects.toMatchObject({ error: 'not_found' });
    await expect(
      service.addItem(SMART_ID, { asset_id: ASSET_A }, STAFF_A),
    ).rejects.toMatchObject({ error: 'not_found' });
    await expect(service.removeItem(SMART_ID, ASSET_A, STAFF_A)).rejects.toMatchObject({
      error: 'not_found',
    });
  });
});

describe('CpCollectionsService quality', () => {
  it('counts missing metadata and groups duplicates by hash only', async () => {
    const db = new CollectionQuery();
    db.assets.push(
      assetRow(ASSET_A, STAFF_A.staffId, { hash: 'dup', filename: 'a.png' }),
      assetRow(ASSET_B, STAFF_A.staffId, { hash: 'dup', filename: 'b.png' }),
      assetRow('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', STAFF_A.staffId, {
        filename: '',
        mime: 'image/png',
        hash: null,
        bytes: null,
      }),
    );
    const service = new CpCollectionsService(db as never);

    const report = await service.quality(STAFF_A);

    expect(report.missing_metadata_count).toBe(1);
    expect(report.duplicates).toEqual([
      expect.objectContaining({ hash: 'dup', count: 2 }),
    ]);
    expect(db.sqls.some((sql) => /phash|perceptual/i.test(sql))).toBe(false);
    expect(db.sqls.some((sql) => /DELETE/i.test(sql))).toBe(false);
  });
});
