import { ServiceUnavailableException } from '@nestjs/common';
import { ContentOsPortfolioService } from './content-os-portfolio.service';

function makeSvc(repo: object) {
  return new ContentOsPortfolioService(
    repo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('ContentOsPortfolioService audit export', () => {
  it('writes an append-only audit_export row then returns real activity CSV', async () => {
    const activity = {
      actor: 'editor@ptt.vn',
      action: 'manual',
      entity: 'item_version',
      created_at: '2026-09-10T08:00:00.000Z',
      item_id: 21,
      id: 9,
    };
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(true),
      insertAuditExport: jest.fn().mockResolvedValue({
        actor: 'admin@ptt.vn',
        action: 'audit_export',
        entity: 'portfolio_audit',
        created_at: '2026-09-11T07:47:00.000Z',
      }),
      listAuditActivity: jest.fn().mockResolvedValue([activity]),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = makeSvc(repo);
    const csv = await svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' });
    expect(repo.insertAuditExport).toHaveBeenCalledWith({
      actor: 'admin@ptt.vn',
      action: 'audit_export',
      entity: 'portfolio_audit',
    });
    expect(repo.listAuditActivity).toHaveBeenCalledWith([4]);
    expect(csv).toMatch(/^actor,action,entity,created_at,item_id,id\n/);
    expect(csv).toContain('editor@ptt.vn,manual,item_version,2026-09-10T08:00:00.000Z,21,9');
    expect(csv).not.toMatch(/prompt|sk_|Sunlight|Nova/i);
  });

  it('returns headers-only CSV when the board has no activity after a successful audit insert', async () => {
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(true),
      insertAuditExport: jest.fn().mockResolvedValue({
        actor: 'admin@ptt.vn',
        action: 'audit_export',
        entity: 'portfolio_audit',
        created_at: '2026-09-11T07:47:00.000Z',
      }),
      listAuditActivity: jest.fn().mockResolvedValue([]),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = makeSvc(repo);
    const csv = await svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' });
    expect(repo.insertAuditExport).toHaveBeenCalled();
    expect(csv.split(/\r?\n/).filter((line) => line.length > 0)).toEqual([
      'actor,action,entity,created_at,item_id,id',
    ]);
  });

  it('throws 503 and does not return CSV when inserting the audit_export row fails (missing table)', async () => {
    const missing = Object.assign(new Error('relation "cmkt_audit_exports" does not exist'), {
      code: '42P01',
    });
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(true),
      insertAuditExport: jest.fn().mockRejectedValue(missing),
      listAuditActivity: jest.fn(),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = makeSvc(repo);
    await expect(svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' })).rejects.toMatchObject({
      status: 503,
    });
    expect(repo.listAuditActivity).not.toHaveBeenCalled();
  });

  it('throws 503 and does not return CSV when inserting the audit_export row hits a DB error', async () => {
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(true),
      insertAuditExport: jest.fn().mockRejectedValue(new Error('connection reset')),
      listAuditActivity: jest.fn(),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = makeSvc(repo);
    await expect(svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' })).rejects.toMatchObject({
      status: 503,
    });
    expect(repo.listAuditActivity).not.toHaveBeenCalled();
  });

  it('throws 503 when postgres is not ready instead of inventing rows', async () => {
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(false),
      insertAuditExport: jest.fn(),
      listAuditActivity: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' })).rejects.toMatchObject({
      status: 503,
    });
    expect(repo.insertAuditExport).not.toHaveBeenCalled();
    expect(repo.listAuditActivity).not.toHaveBeenCalled();
  });
});
