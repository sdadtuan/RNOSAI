import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StreamableFile } from '@nestjs/common';
import { mintAssetStreamQuery } from './cp-asset-signed-url.util';
import { CpAssetsService, assertMime, rightsStatus } from './cp-assets.service';

const ASSET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const V1_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const V2_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DRAFT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const VIDEO_VERSION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PROJECT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const SCOPE = { scope: 'all' as const, staffId: 1 };

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

describe('CpAssetsService', () => {
  it('rejects executable MIME', () => {
    expect(() => assertMime('application/x-msdownload')).toThrow(/mime_not_allowed/);
  });
  it('rights block after expiry', () => {
    expect(rightsStatus('2020-01-01', '2026-09-07')).toBe('block');
    expect(rightsStatus('2026-09-12', '2026-09-07')).toBe('warn');
  });

  it('returns the rights fields needed to preserve edits', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new CpAssetsService({ query } as never);

    await service.listAssets({ scope: 'all', staffId: 1 });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('r.license_type');
    expect(sql).toContain('r.territory');
    expect(sql).toContain('r.model_release');
  });

  it('usageGraph lists draft, video_version, and project', async () => {
    const query = jest.fn().mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_assets/i.test(sql)) {
        return {
          rows: [{ id: ASSET_ID, project_id: PROJECT_ID, filename: 'hero.png', mime: 'image/png' }],
          rowCount: 1,
        };
      }
      if (/crm_cp_asset_versions/i.test(sql)) {
        return {
          rows: [
            {
              asset_version_id: V1_ID,
              n: 1,
              storage_key: 'v1',
              mime: 'image/png',
              bytes: 12,
              object_type: 'video_draft',
              object_id: DRAFT_ID,
            },
            {
              asset_version_id: V1_ID,
              n: 1,
              storage_key: 'v1',
              mime: 'image/png',
              bytes: 12,
              object_type: 'video_version',
              object_id: VIDEO_VERSION_ID,
            },
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const service = new CpAssetsService({ query } as never);

    const graph = await service.usageGraph(ASSET_ID, SCOPE);
    const types = graph.usages.map((row) => row.object_type);

    expect(types).toEqual(expect.arrayContaining(['video_draft', 'video_version', 'project']));
    expect(graph.usages.find((row) => row.object_type === 'project')?.object_id).toBe(PROJECT_ID);
    expect(graph.usages.find((row) => row.object_type === 'video_version')?.asset_version_id).toBe(
      V1_ID,
    );
  });

  it('replace inserts n+1 and never updates a completed version row', async () => {
    const versions: Record<string, unknown>[] = [
      { id: V1_ID, asset_id: ASSET_ID, n: 1, storage_key: 'old-key', mime: 'image/png', bytes: 10 },
    ];
    const usages = [
      { asset_version_id: V1_ID, object_type: 'video_version', object_id: VIDEO_VERSION_ID },
      { asset_version_id: V1_ID, object_type: 'video_draft', object_id: DRAFT_ID },
      { asset_version_id: V1_ID, object_type: 'project', object_id: PROJECT_ID },
    ];
    const queryImplementation: QueryFn = async (sql: string, params: unknown[] = []) => {
      if (/FROM crm_cp_assets/i.test(sql)) {
        return {
          rows: [{ id: ASSET_ID, project_id: PROJECT_ID, filename: 'hero.png', mime: 'image/png' }],
          rowCount: 1,
        };
      }
      if (/INSERT INTO crm_cp_asset_versions/i.test(sql)) {
        const row = {
          id: V2_ID,
          asset_id: ASSET_ID,
          n: versions.length + 1,
          storage_key: params[1],
          mime: params[2],
          bytes: params[3],
        };
        versions.push(row);
        return { rows: [row], rowCount: 1 };
      }
      if (/UPDATE[\s\S]*crm_cp_asset_usages/i.test(sql)) {
        for (const usage of usages) {
          if (usage.object_type !== 'video_version') usage.asset_version_id = String(params[0]);
        }
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    };
    const query = jest.fn(queryImplementation);
    const transaction = jest.fn(
      async (work: (tx: { query: jest.MockedFunction<QueryFn> }) => Promise<unknown>) =>
        work({ query }),
    );
    const service = new CpAssetsService({ query, transaction } as never);

    const created = await service.replaceFile(
      ASSET_ID,
      { mime: 'image/jpeg', storage_key: 'new-key', bytes: 20, filename: 'hero-v2.jpg' },
      SCOPE,
    );

    expect(created.n).toBe(2);
    expect(created.storage_key).toBe('new-key');
    expect(versions[0]).toMatchObject({ id: V1_ID, n: 1, storage_key: 'old-key' });
    expect(query.mock.calls.some(([sql]) => /UPDATE[\s\S]*crm_cp_asset_versions/i.test(sql))).toBe(
      false,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('replace leaves completed video_version usage on the old asset_version_id', async () => {
    const usages = [
      { asset_version_id: V1_ID, object_type: 'video_version', object_id: VIDEO_VERSION_ID },
      { asset_version_id: V1_ID, object_type: 'video_draft', object_id: DRAFT_ID },
    ];
    const queryImplementation: QueryFn = async (sql: string, params: unknown[] = []) => {
      if (/FROM crm_cp_assets/i.test(sql)) {
        return {
          rows: [{ id: ASSET_ID, project_id: PROJECT_ID, filename: 'hero.png', mime: 'image/png' }],
          rowCount: 1,
        };
      }
      if (/INSERT INTO crm_cp_asset_versions/i.test(sql)) {
        return {
          rows: [{ id: V2_ID, asset_id: ASSET_ID, n: 2, storage_key: params[1], mime: params[2] }],
          rowCount: 1,
        };
      }
      if (/UPDATE[\s\S]*crm_cp_asset_usages/i.test(sql)) {
        for (const usage of usages) {
          if (usage.object_type !== 'video_version') usage.asset_version_id = String(params[0]);
        }
        return { rows: [], rowCount: 0 };
      }
      if (/UPDATE[\s\S]*crm_cp_video_versions/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    };
    const query = jest.fn(queryImplementation);
    const service = new CpAssetsService({
      query,
      transaction: async (work: (tx: { query: typeof query }) => Promise<unknown>) => work({ query }),
    } as never);

    await service.replaceFile(
      ASSET_ID,
      { mime: 'image/png', storage_key: 'v2-key', bytes: 30 },
      SCOPE,
    );

    expect(usages.find((row) => row.object_type === 'video_version')?.asset_version_id).toBe(V1_ID);
    expect(query.mock.calls.some(([sql]) => /UPDATE[\s\S]*crm_cp_video_versions/i.test(sql))).toBe(
      false,
    );
    expect(
      query.mock.calls.some(
        ([sql]) => /UPDATE[\s\S]*crm_cp_asset_usages/i.test(sql) && /video_version/i.test(sql),
      ),
    ).toBe(false);
  });

  describe('signed weave stream', () => {
    const KEY = 'nova/mid-autumn-2026/CR-2026-0912-028/review/CR-2026-0912-028_v01_9x16.mp4';
    const SOURCE_KEY = 'nova/mid-autumn-2026/CR-2026-0912-028/source/CR-2026-0912-028_v01_9x16.mp4';
    let tmp = '';
    let prevPrefix: string | undefined;
    let prevSecret: string | undefined;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-asset-stream-'));
      fs.mkdirSync(path.dirname(path.join(tmp, KEY)), { recursive: true });
      fs.writeFileSync(path.join(tmp, KEY), 'fake-mp4');
      prevPrefix = process.env.WEAVE_EXPORT_PREFIX;
      prevSecret = process.env.PTT_ASSET_STREAM_SECRET;
      process.env.WEAVE_EXPORT_PREFIX = tmp;
      process.env.PTT_ASSET_STREAM_SECRET = 'unit-asset-stream';
    });

    afterEach(() => {
      if (prevPrefix == null) delete process.env.WEAVE_EXPORT_PREFIX;
      else process.env.WEAVE_EXPORT_PREFIX = prevPrefix;
      if (prevSecret == null) delete process.env.PTT_ASSET_STREAM_SECRET;
      else process.env.PTT_ASSET_STREAM_SECRET = prevSecret;
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    function serviceWith(rows: {
      asset?: Record<string, unknown>;
      weave?: Record<string, unknown> | null;
    }) {
      const query = jest.fn().mockImplementation(async (sql: string) => {
        if (/FROM crm_cp_assets/i.test(sql)) {
          return {
            rows: rows.asset ? [rows.asset] : [],
            rowCount: rows.asset ? 1 : 0,
          };
        }
        if (/FROM crm_cp_weave_assets/i.test(sql)) {
          return {
            rows: rows.weave ? [rows.weave] : [],
            rowCount: rows.weave ? 1 : 0,
          };
        }
        return { rows: [], rowCount: 0 };
      });
      return new CpAssetsService({ query } as never);
    }

    it('mints a signed file URL for a review weave asset', async () => {
      const service = serviceWith({
        asset: { id: ASSET_ID, filename: 'CR-2026-0912-028_v01_9x16.mp4', mime: 'video/mp4' },
        weave: { storage_uri: KEY },
      });

      const minted = await service.mintStreamUrl(ASSET_ID, SCOPE);

      expect(minted.mime).toBe('video/mp4');
      expect(minted.url).toContain(`/api/crm/cp/assets/${ASSET_ID}/file?`);
      expect(minted.url).toContain('exp=');
      expect(minted.url).toContain('sig=');
    });

    it('rejects source lane and missing weave row', async () => {
      const source = serviceWith({
        asset: { id: ASSET_ID, filename: 'clip.mp4', mime: 'video/mp4' },
        weave: { storage_uri: SOURCE_KEY },
      });
      await expect(source.mintStreamUrl(ASSET_ID, SCOPE)).rejects.toMatchObject({
        status: 404,
        error: 'not_found',
      });

      const missing = serviceWith({
        asset: { id: ASSET_ID, filename: 'clip.mp4', mime: 'video/mp4' },
        weave: null,
      });
      await expect(missing.mintStreamUrl(ASSET_ID, SCOPE)).rejects.toMatchObject({
        status: 404,
        error: 'not_found',
      });
    });

    it('streams the file when the signature is valid and rejects expired sigs', async () => {
      const service = serviceWith({
        asset: { id: ASSET_ID, filename: 'CR-2026-0912-028_v01_9x16.mp4', mime: 'video/mp4' },
        weave: { storage_uri: KEY },
      });
      const minted = mintAssetStreamQuery({
        resource: 'cp_asset',
        id: ASSET_ID,
        secret: 'unit-asset-stream',
        ttlSec: 900,
      });

      const file = await service.openStream(ASSET_ID, String(minted.exp), minted.sig);
      expect(file.file).toBeInstanceOf(StreamableFile);
      expect(file.mime).toBe('video/mp4');
      expect(file.filename).toBe('CR-2026-0912-028_v01_9x16.mp4');
      const chunks: Buffer[] = [];
      for await (const chunk of file.file.getStream()) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString()).toBe('fake-mp4');

      await expect(
        service.openStream(ASSET_ID, String(minted.exp - 10_000), minted.sig),
      ).rejects.toMatchObject({ status: 401 });
    });
  });
});
