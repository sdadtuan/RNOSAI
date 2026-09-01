import { ForbiddenException } from '@nestjs/common';
import { StaffMarketingAiPlaybookStaffApproveGuard } from './guards/staff-marketing-ai-planner.guard';
import { MarketingAiPlaybookAdminController } from './marketing-ai-playbook-admin.controller';
import { MktAiPlaybookAdminService } from './mkt-ai-playbook-admin.service';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';

describe('MarketingAiPlaybookAdminController', () => {
  const admin = {
    listCatalog: jest.fn(),
    getSlugDetail: jest.fn(),
    patchPolicy: jest.fn(),
    enqueueLearn: jest.fn(),
    getLearnJob: jest.fn(),
    patchVersionDocument: jest.fn(),
    submitVersion: jest.fn(),
    decideVersion: jest.fn(),
    activateVersion: jest.fn(),
    rollbackVersion: jest.fn(),
  };

  const playbooks = {
    listAdminCatalog: jest.fn(),
  };

  const controller = new MarketingAiPlaybookAdminController(
    admin as unknown as MktAiPlaybookAdminService,
    playbooks as unknown as MarketingAiPlaybookService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listPlaybooks delegates to admin.listCatalog', async () => {
    admin.listCatalog.mockResolvedValue({ ok: true, items: [] });
    await expect(controller.listPlaybooks()).resolves.toEqual({ ok: true, items: [] });
    expect(admin.listCatalog).toHaveBeenCalled();
  });

  it('enqueueLearn passes actor and exclude ids', async () => {
    admin.enqueueLearn.mockResolvedValue({ job_id: 9, status: 'queued' });
    const req = { staffUser: { email: 'lead@test.vn' }, staffAuthVia: 'jwt' } as never;
    await controller.enqueueLearn(
      'meta-lead-gen',
      { exclude_lifecycle_ids: [1, 2] },
      req,
    );
    expect(admin.enqueueLearn).toHaveBeenCalledWith('meta-lead-gen', 'lead@test.vn', [1, 2]);
  });

  it('activateVersion passes body and staff actor', async () => {
    admin.activateVersion.mockResolvedValue({ ok: true, version: { id: 5 } });
    const req = { staffUser: { email: 'lead@test.vn' }, staffAuthVia: 'jwt' } as never;
    await controller.activateVersion(
      5,
      { self_approve: true, note: 'Lead kiêm SP duyệt bản này', accept_shallow: true },
      req,
    );
    expect(admin.activateVersion).toHaveBeenCalledWith(
      5,
      { self_approve: true, note: 'Lead kiêm SP duyệt bản này', accept_shallow: true },
      'lead@test.vn',
    );
  });
});

describe('StaffMarketingAiPlaybookStaffApproveGuard activate', () => {
  const staffAuth = {
    me: jest.fn(),
    hasCap: jest.fn(),
  };
  const guard = new StaffMarketingAiPlaybookStaffApproveGuard(staffAuth as never);

  function ctx(req: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as never;
  }

  it('blocks internal/AI token with 403 staff_jwt_required', async () => {
    await expect(
      guard.canActivate(ctx({ staffAuthVia: 'internal' })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await guard.canActivate(ctx({ staffAuthVia: 'internal' }));
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ error: 'staff_jwt_required' }),
      );
    }
  });

  it('allows staff JWT with crm_mkt_ai.approve', async () => {
    staffAuth.me.mockResolvedValue({ caps: {} });
    staffAuth.hasCap.mockReturnValue(true);
    await expect(
      guard.canActivate(
        ctx({ staffAuthVia: 'jwt', staffUser: { email: 'lead@test.vn' } }),
      ),
    ).resolves.toBe(true);
  });
});
