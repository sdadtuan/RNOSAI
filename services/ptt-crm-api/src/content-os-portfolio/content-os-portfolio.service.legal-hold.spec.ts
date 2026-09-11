import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc(repo: object, marketingRepo: object = {}, staffAuth?: object) {
  return new ContentOsPortfolioService(
    repo as never,
    {} as never,
    marketingRepo as never,
    {} as never,
    {} as never,
    staffAuth as never,
  );
}

function writerAuth() {
  return {
    me: jest.fn().mockResolvedValue({
      caps: [{ section: 'crm_content', action: 'write' }],
      position_code: 'writer',
    }),
    hasCap: (caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((cap) => cap.section === section && cap.action === action),
    isSuperAdminPosition: () => false,
  };
}

describe('ContentOsPortfolioService legal hold', () => {
  it('hard delete is atomic and blocked with 409 legal_hold when the delete matches a held row', async () => {
    const repo = {
      hardDeleteItem: jest.fn().mockResolvedValue('held'),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).rejects.toMatchObject({
      status: 409,
      response: { error: 'legal_hold' },
    });
    expect(repo.hardDeleteItem).toHaveBeenCalledWith({
      itemId: 21,
      actor: 'admin@ptt.vn',
      lifecycleIds: [4],
    });
    expect(repo.getItemLegalHold).not.toHaveBeenCalled();
  });

  it('hard deletes atomically and writes the audit event inside the delete', async () => {
    const repo = {
      hardDeleteItem: jest.fn().mockResolvedValue('deleted'),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 21, actor: 'admin@ptt.vn' })).resolves.toEqual({
      ok: true,
      id: 21,
    });
    expect(repo.hardDeleteItem).toHaveBeenCalledWith({
      itemId: 21,
      actor: 'admin@ptt.vn',
      lifecycleIds: [4],
    });
    expect(repo.getItemLegalHold).not.toHaveBeenCalled();
  });

  it('returns 404 when the atomic delete finds no row', async () => {
    const repo = {
      hardDeleteItem: jest.fn().mockResolvedValue('missing'),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.hardDeleteItem({ staffId: 7, itemId: 99, actor: 'admin@ptt.vn' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.hardDeleteItem).toHaveBeenCalledWith({
      itemId: 99,
      actor: 'admin@ptt.vn',
      lifecycleIds: [4],
    });
    expect(repo.getItemLegalHold).not.toHaveBeenCalled();
  });

  it('enables legal hold with reason, persists set_by, and audits on', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        legal_hold: false,
        legal_hold_set_by: null,
      }),
      updateLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        legal_hold: true,
        legal_hold_set_by: 'w@ptt.vn',
      }),
      insertAuditExport: jest.fn().mockResolvedValue({}),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ id: 21, lifecycle_id: 4 }) };
    const svc = makeSvc(repo, marketingRepo, writerAuth());
    await expect(
      svc.patchLegalHold({
        staffId: 7,
        itemId: 21,
        actor: 'w@ptt.vn',
        body: { legal_hold: true, reason: 'tranh chấp hợp đồng Q4' },
        staffUser: { sub: '7', email: 'w@ptt.vn' } as never,
      }),
    ).resolves.toMatchObject({ legal_hold: true, legal_hold_set_by: 'w@ptt.vn' });
    expect(repo.updateLegalHold).toHaveBeenCalledWith({
      itemId: 21,
      legal_hold: true,
      setBy: 'w@ptt.vn',
      reason: 'tranh chấp hợp đồng Q4',
      lifecycleIds: [4],
    });
    expect(repo.insertAuditExport).toHaveBeenCalledWith({
      actor: 'w@ptt.vn',
      action: 'legal_hold',
      entity: 'item:21:on',
    });
  });

  it('rejects enable when reason is shorter than 10', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      updateLegalHold: jest.fn(),
    };
    const svc = makeSvc(repo, {}, writerAuth());
    await expect(
      svc.patchLegalHold({
        staffId: 7,
        itemId: 21,
        actor: 'w@ptt.vn',
        body: { legal_hold: true, reason: 'short' },
        staffUser: { sub: '7', email: 'w@ptt.vn' } as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateLegalHold).not.toHaveBeenCalled();
  });

  it('rejects enable when actor lacks crm_content.write', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      updateLegalHold: jest.fn(),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ id: 21, lifecycle_id: 4 }) };
    const qaOnly = {
      me: jest.fn().mockResolvedValue({
        caps: [{ section: 'crm_content', action: 'qa' }],
        position_code: 'qa',
      }),
      hasCap: (caps: Array<{ section: string; action: string }>, section: string, action: string) =>
        caps.some((cap) => cap.section === section && cap.action === action),
      isSuperAdminPosition: () => false,
    };
    const svc = makeSvc(repo, marketingRepo, qaOnly);
    await expect(
      svc.patchLegalHold({
        staffId: 7,
        itemId: 21,
        actor: 'qa@ptt.vn',
        body: { legal_hold: true, reason: 'tranh chấp hợp đồng Q4' },
        staffUser: { sub: '7', email: 'qa@ptt.vn' } as never,
      }),
    ).rejects.toMatchObject({ status: 403, response: { error: 'missing_cap', section: 'crm_content', action: 'write' } });
    expect(repo.updateLegalHold).not.toHaveBeenCalled();
  });

  it('allows QA without write to release hold', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        legal_hold: true,
        legal_hold_set_by: 'w@ptt.vn',
      }),
      updateLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        legal_hold: false,
        legal_hold_set_by: null,
      }),
      insertAuditExport: jest.fn().mockResolvedValue({}),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ id: 21, lifecycle_id: 4 }) };
    const qaOnly = {
      me: jest.fn().mockResolvedValue({
        caps: [{ section: 'crm_content', action: 'qa' }],
        position_code: 'qa',
      }),
      hasCap: (caps: Array<{ section: string; action: string }>, section: string, action: string) =>
        caps.some((cap) => cap.section === section && cap.action === action),
      isSuperAdminPosition: () => false,
    };
    const svc = makeSvc(repo, marketingRepo, qaOnly);
    await expect(
      svc.patchLegalHold({
        staffId: 7,
        itemId: 21,
        actor: 'qa@ptt.vn',
        body: { legal_hold: false, reason: 'dispute resolved' },
        staffUser: { sub: '7', email: 'qa@ptt.vn' } as never,
      }),
    ).resolves.toMatchObject({ legal_hold: false, legal_hold_set_by: null });
    expect(repo.updateLegalHold).toHaveBeenCalledWith({
      itemId: 21,
      legal_hold: false,
      setBy: null,
      reason: 'dispute resolved',
      lifecycleIds: [4],
    });
    expect(repo.insertAuditExport).toHaveBeenCalledWith({
      actor: 'qa@ptt.vn',
      action: 'legal_hold',
      entity: 'item:21:off',
    });
  });

  it('blocks writer release even when they have crm_content.write', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        legal_hold: true,
        legal_hold_set_by: 'a@ptt.vn',
      }),
      updateLegalHold: jest.fn(),
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ id: 21, lifecycle_id: 4 }) };
    const svc = makeSvc(repo, marketingRepo, writerAuth());
    await expect(
      svc.patchLegalHold({
        staffId: 7,
        itemId: 21,
        actor: 'w@ptt.vn',
        body: { legal_hold: false, reason: 'release hold now' },
        staffUser: { sub: '7', email: 'w@ptt.vn' } as never,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updateLegalHold).not.toHaveBeenCalled();
  });

  it('blocks SoD self-release when CMKT_SOD_ENABLED=1', async () => {
    const prev = process.env.CMKT_SOD_ENABLED;
    process.env.CMKT_SOD_ENABLED = '1';
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getItemLegalHold: jest.fn().mockResolvedValue({
        id: 21,
        legal_hold: true,
        legal_hold_set_by: 'a@ptt.vn',
      }),
      updateLegalHold: jest.fn(),
    };
    const qaAuth = {
      me: jest.fn().mockResolvedValue({
        caps: [{ section: 'crm_content', action: 'qa' }],
        position_code: 'qa',
      }),
      hasCap: (caps: Array<{ section: string; action: string }>, section: string, action: string) =>
        caps.some((cap) => cap.section === section && cap.action === action),
      isSuperAdminPosition: () => false,
    };
    const marketingRepo = { findItemById: jest.fn().mockResolvedValue({ id: 21, lifecycle_id: 4 }) };
    const svc = makeSvc(repo, marketingRepo, qaAuth);
    try {
      await expect(
        svc.patchLegalHold({
          staffId: 7,
          itemId: 21,
          actor: 'a@ptt.vn',
          body: { legal_hold: false, reason: 'release hold now' },
          staffUser: { sub: '7', email: 'a@ptt.vn' } as never,
        }),
      ).rejects.toMatchObject({ status: 403, response: { error: 'sod_hold_release' } });
      expect(repo.updateLegalHold).not.toHaveBeenCalled();
    } finally {
      if (prev == null) delete process.env.CMKT_SOD_ENABLED;
      else process.env.CMKT_SOD_ENABLED = prev;
    }
  });
});
