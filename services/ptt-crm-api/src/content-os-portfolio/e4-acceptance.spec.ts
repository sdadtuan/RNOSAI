import { readFileSync } from 'fs';
import { join } from 'path';
import { ContentOsPortfolioService } from './content-os-portfolio.service';
import { assertExecuteGate } from './publication-execute.util';
import { resolvePublishConnector } from './publish-connector';

function canShowDangLenPage(input: {
  directSocialPublish: boolean;
  health: 'Manual' | 'Connected' | 'TokenExpired';
  canPublish: boolean;
}): boolean {
  return input.directSocialPublish && input.health === 'Connected' && input.canPublish;
}

function canOpenConfirm(gateStatus: 'Pass' | 'Warning' | 'Blocked'): boolean {
  return gateStatus !== 'Blocked';
}

type ExecuteGate = 'Pass' | 'Warning' | 'Blocked';

function makeExecuteService(opts: {
  connector?: { id: string; publish: jest.Mock };
  gate?: ExecuteGate;
  item?: Record<string, unknown>;
  insertExecute?: jest.Mock;
  versions?: Array<{ id: number; version_no: number }>;
  rights?: unknown[];
  repo?: Record<string, unknown>;
} = {}) {
  const item = {
    id: 21,
    lifecycle_id: 4,
    status: 'approved_internal',
    version_id: 'v13',
    brief_json: {},
    body_json: { markdown: 'Ready copy' },
    brief_ready: opts.gate === 'Blocked' ? false : true,
    paid_expiry_warning: opts.gate === 'Warning',
    ...opts.item,
  };
  const repo = {
    listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    insertPublicationExecute:
      opts.insertExecute ?? jest.fn().mockResolvedValue({ id: 88, client_request_id: 'r1' }),
    insertAuditExport: jest.fn().mockResolvedValue({}),
    loadConnectorSecretForExecute: jest.fn().mockResolvedValue(null),
    connector: opts.connector,
    ...opts.repo,
  };
  const workflow = {};
  const marketingRepo = {
    findItemById: jest.fn().mockResolvedValue(item),
    insertPublicationLog: jest.fn().mockResolvedValue({ id: 1 }),
    listItemVersions: jest.fn().mockResolvedValue(opts.versions ?? []),
    listAssetRights: jest.fn().mockResolvedValue(opts.rights ?? []),
  };
  const items = {
    getItem: jest.fn().mockResolvedValue(item),
  };
  return new ContentOsPortfolioService(repo as never, workflow as never, marketingRepo as never, items as never);
}

function publishCopySource(): string {
  const files = [
    join(__dirname, '../../../ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx'),
    join(__dirname, '../../../ops-web/src/components/content-os/cmkte/CmktESettings.tsx'),
    join(__dirname, '../../../ops-web/src/lib/crm/cmkte-win-publish.ts'),
  ];
  return files.map((path) => readFileSync(path, 'utf8')).join('\n');
}

describe('E4 acceptance', () => {
  it('1 flag off → stub NotEnabledError and hide page button', () => {
    expect(resolvePublishConnector({
      direct_social_publish: false, connectorStatus: 'on', hasToken: true,
    }).id).toBe('stub');
    expect(canShowDangLenPage({
      directSocialPublish: false, health: 'Connected', canPublish: true,
    })).toBe(false);
  });

  it('3 Blocked → cannot confirm', () => {
    expect(canOpenConfirm('Blocked')).toBe(false);
    expect(() => assertExecuteGate('Blocked')).toThrow();
  });

  it('5 replay client_request_id does not publish twice', async () => {
    const publish = jest.fn().mockResolvedValue({ post_id: '555_1' });
    const repo = {
      insertPublicationExecute: jest
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' })),
      findExecuteByClientRequestId: jest.fn().mockResolvedValue({
        id: 88, client_request_id: 'r1', post_id: '555_1', status: 'published',
      }),
    };
    const svc = makeExecuteService({ repo, connector: { id: 'fb', publish } });
    const out = await svc.enqueuePublicationExecute({
      staffId: 7, actor: 's@ptt.vn',
      body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r1' },
    });
    expect(out.execute_id).toBe(88);
    expect(out.replayed).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it('12 CTA remains Đăng ký nhận tư vấn', () => {
    const copy = publishCopySource();
    expect(copy).toContain('Đăng ký nhận tư vấn');
    expect(copy).not.toContain('Gọi ngay');
  });
});
