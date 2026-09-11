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
  it('writes an append-only audit_export row then returns CSV metadata', async () => {
    const inserted = {
      actor: 'admin@ptt.vn',
      action: 'audit_export',
      entity: 'portfolio_audit',
      created_at: '2026-09-11T07:47:00.000Z',
    };
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(true),
      insertAuditExport: jest.fn().mockResolvedValue(inserted),
      listAuditExports: jest.fn().mockResolvedValue([inserted]),
    };
    const svc = makeSvc(repo);
    const csv = await svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' });
    expect(repo.insertAuditExport).toHaveBeenCalledWith({
      actor: 'admin@ptt.vn',
      action: 'audit_export',
      entity: 'portfolio_audit',
    });
    expect(repo.listAuditExports).toHaveBeenCalled();
    expect(csv).toMatch(/^actor,action,entity,created_at\n/);
    expect(csv).toContain('admin@ptt.vn,audit_export,portfolio_audit,2026-09-11T07:47:00.000Z');
    expect(csv).not.toMatch(/prompt|sk_|Sunlight|Nova/i);
  });

  it('returns headers-only CSV when there are no audit rows (no fake data)', async () => {
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(true),
      insertAuditExport: jest.fn().mockResolvedValue({
        actor: 'admin@ptt.vn',
        action: 'audit_export',
        entity: 'portfolio_audit',
        created_at: '2026-09-11T07:47:00.000Z',
      }),
      listAuditExports: jest.fn().mockResolvedValue([]),
    };
    const svc = makeSvc(repo);
    const csv = await svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' });
    expect(csv.split(/\r?\n/).filter((line) => line.length > 0)).toEqual([
      'actor,action,entity,created_at',
    ]);
  });

  it('returns headers-only CSV when the audit table is missing (42P01)', async () => {
    const missing = Object.assign(new Error('relation "cmkt_audit_exports" does not exist'), {
      code: '42P01',
    });
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(true),
      insertAuditExport: jest.fn().mockRejectedValue(missing),
      listAuditExports: jest.fn(),
    };
    const svc = makeSvc(repo);
    const csv = await svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' });
    expect(csv.split(/\r?\n/).filter((line) => line.length > 0)).toEqual([
      'actor,action,entity,created_at',
    ]);
  });

  it('throws 503 when postgres is not ready instead of inventing rows', async () => {
    const repo = {
      ensurePgReady: jest.fn().mockResolvedValue(false),
      insertAuditExport: jest.fn(),
      listAuditExports: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.exportAuditCsv({ staffId: 7, actor: 'admin@ptt.vn' })).rejects.toMatchObject({
      status: 503,
    });
    expect(repo.insertAuditExport).not.toHaveBeenCalled();
    expect(repo.listAuditExports).not.toHaveBeenCalled();
  });
});
