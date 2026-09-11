import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StaffContentMarketingExecuteGuard } from '../content-marketing/guards/staff-content-marketing.guard';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

type ExecuteGate = 'Pass' | 'Warning' | 'Blocked';

function makeExecuteService(opts: {
  connector?: { id: string; publish: jest.Mock };
  gate?: ExecuteGate;
  item?: Record<string, unknown>;
  insertExecute?: jest.Mock;
} = {}) {
  const item = {
    id: 21,
    lifecycle_id: 4,
    status: 'approved_internal',
    version_id: 'v13',
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
  };
  const workflow = {};
  const marketingRepo = {
    findItemById: jest.fn().mockResolvedValue(item),
    insertPublicationLog: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const items = {
    getItem: jest.fn().mockResolvedValue(item),
  };
  return new ContentOsPortfolioService(repo as never, workflow as never, marketingRepo as never, items as never);
}

describe('ContentOsPortfolioService enqueuePublicationExecute', () => {
  it('returns 400 when confirm is not true and does not call connector', async () => {
    const connector = { id: 'fb', publish: jest.fn() };
    const svc = makeExecuteService({ connector });
    await expect(svc.enqueuePublicationExecute({
      staffId: 7, actor: 'social@ptt.vn',
      body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: false, client_request_id: 'r1' },
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(connector.publish).not.toHaveBeenCalled();
  });

  it('returns queued without awaiting Graph', async () => {
    const svc = makeExecuteService({
      gate: 'Pass',
      item: { id: 21, lifecycle_id: 4, status: 'approved_internal', version_id: 'v13' },
      insertExecute: jest.fn().mockResolvedValue({ id: 88, client_request_id: 'r1' }),
    });
    const out = await svc.enqueuePublicationExecute({
      staffId: 7, actor: 'social@ptt.vn',
      body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r1' },
    });
    expect(out).toEqual({ queued: true, client_request_id: 'r1', execute_id: 88 });
  });

  it('rejects when snapshot_id is not the locked version', async () => {
    const svc = makeExecuteService({ item: { id: 21, version_id: 'v14' } });
    await expect(svc.enqueuePublicationExecute({
      staffId: 7, actor: 'x',
      body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r2' },
    })).rejects.toMatchObject({ response: { error: 'material_change' } });
  });
});

describe('StaffContentMarketingExecuteGuard', () => {
  it('rejects write-only staff with 403', async () => {
    const staffAuth = {
      me: jest.fn().mockResolvedValue({
        caps: [
          { section: 'crm_board', action: 'edit' },
          { section: 'crm_content', action: 'write' },
        ],
      }),
      hasCap: jest.fn(
        (caps: Array<{ section: string; action: string }>, section: string, action: string) =>
          caps.some((cap) => cap.section === section && cap.action === action),
      ),
    };
    const guard = new StaffContentMarketingExecuteGuard(staffAuth as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ staffUser: { sub: '7' } }),
      }),
    };
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({ status: 403 });
  });
});
