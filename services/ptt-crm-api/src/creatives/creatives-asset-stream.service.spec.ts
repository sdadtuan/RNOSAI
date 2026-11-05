import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ForbiddenException, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { mintAssetStreamQuery } from '../cp/cp-asset-signed-url.util';
import { CreativesService } from './creatives.service';
import { CreativeRow } from './creatives.types';

const CREATIVE_ID = '7ec2dfc1-2f55-4493-80e7-cf41b137175d';
const CLIENT_ID = '88b86b90-e943-447c-822a-0b8ac38f3603';
const OTHER_CLIENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY = 'ptt-hcm/meta-lead-gen/CR-2026-0913-001/review/CR-2026-0913-001_v01_9x16.mp4';

const user = {
  sub: '1e77ca83-d051-4f99-a8b5-c5fdbd89dd44',
  email: 'uat.weave.approver@pttads.vn',
  client_id: CLIENT_ID,
  role: 'approver' as const,
  iat: 1,
  exp: 9_999_999_999,
};

function row(overrides: Partial<CreativeRow> = {}): CreativeRow {
  return {
    id: CREATIVE_ID,
    client_id: CLIENT_ID,
    title: 'UAT Mid-Autumn I2V',
    description: null,
    external_campaign_id: null,
    external_campaign_name: null,
    version: 1,
    asset_url: KEY,
    asset_type: 'video',
    status: 'approved',
    submitted_by: 'am@pttads.vn',
    submitted_at: '2026-09-13T00:00:00.000Z',
    reviewed_by: user.email,
    reviewed_at: '2026-09-13T01:00:00.000Z',
    review_note: null,
    temporal_workflow_id: null,
    channel: 'meta',
    ...overrides,
  };
}

function serviceWith(creative: CreativeRow | null) {
  const repo = {
    pgCreativesReady: jest.fn().mockResolvedValue(true),
    findById: jest.fn().mockResolvedValue(creative),
  };
  return new CreativesService(
    repo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('CreativesService asset stream', () => {
  let tmp = '';
  let prevPrefix: string | undefined;
  let prevSecret: string | undefined;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'creative-stream-'));
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

  it('returns an external https asset_url as-is', async () => {
    const https = 'https://cdn.example/creative.mp4';
    const minted = await serviceWith(row({ asset_url: https })).mintAssetUrl(user, CREATIVE_ID);
    expect(minted).toEqual({ url: https, mode: 'external', mime: 'video/mp4' });
  });

  it('mints a signed same-origin URL for a weave review path', async () => {
    const minted = await serviceWith(row()).mintAssetUrl(user, CREATIVE_ID);
    expect(minted.mode).toBe('signed');
    expect(minted.mime).toBe('video/mp4');
    expect(minted.url).toContain(`/api/v1/creatives/${CREATIVE_ID}/asset?`);
  });

  it('rejects a different client_id', async () => {
    await expect(
      serviceWith(row({ client_id: OTHER_CLIENT })).mintAssetUrl(user, CREATIVE_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('streams a valid signature and rejects an expired one', async () => {
    const service = serviceWith(row());
    const minted = mintAssetStreamQuery({
      resource: 'creative',
      id: CREATIVE_ID,
      secret: 'unit-asset-stream',
      ttlSec: 900,
    });
    const file = await service.openAssetStream(CREATIVE_ID, String(minted.exp), minted.sig);
    expect(file.file).toBeInstanceOf(StreamableFile);
    expect(file.mime).toBe('video/mp4');
    const chunks: Buffer[] = [];
    for await (const chunk of file.file.getStream()) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe('fake-mp4');

    await expect(
      service.openAssetStream(CREATIVE_ID, String(minted.exp - 10_000), minted.sig),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
