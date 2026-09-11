import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';

function makeRepo(query: jest.Mock) {
  const repo = new ContentOsPortfolioRepository({ databaseUrl: 'postgres://test' } as never);
  Object.assign(repo, { pool: { query }, pgReady: true });
  return repo;
}

describe('ContentOsPortfolioRepository audit + legal hold', () => {
  it('insertAuditExport writes an append-only audit_export row', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          actor: 'admin@ptt.vn',
          action: 'audit_export',
          entity: 'portfolio_audit',
          created_at: '2026-09-11T07:47:00.000Z',
        },
      ],
    });
    const repo = makeRepo(query);
    const saved = await repo.insertAuditExport({
      actor: 'admin@ptt.vn',
      action: 'audit_export',
      entity: 'portfolio_audit',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO cmkt_audit_exports/),
      ['admin@ptt.vn', 'audit_export', 'portfolio_audit'],
    );
    expect(saved).toEqual({
      actor: 'admin@ptt.vn',
      action: 'audit_export',
      entity: 'portfolio_audit',
      created_at: '2026-09-11T07:47:00.000Z',
    });
  });

  it('listAuditExports returns actor, action, entity, time only', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          actor: 'admin@ptt.vn',
          action: 'audit_export',
          entity: 'portfolio_audit',
          created_at: '2026-09-11T07:47:00.000Z',
        },
      ],
    });
    const repo = makeRepo(query);
    await expect(repo.listAuditExports()).resolves.toEqual([
      {
        actor: 'admin@ptt.vn',
        action: 'audit_export',
        entity: 'portfolio_audit',
        created_at: '2026-09-11T07:47:00.000Z',
      },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/FROM cmkt_audit_exports/));
  });

  it('getItemLegalHold reads legal_hold defaulting false', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: 21, lifecycle_id: 4, legal_hold: false }],
    });
    const repo = makeRepo(query);
    await expect(repo.getItemLegalHold(21)).resolves.toEqual({
      id: 21,
      lifecycle_id: 4,
      legal_hold: false,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/legal_hold/),
      [21],
    );
  });

  it('hardDeleteItem issues DELETE and does not update audit rows', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const repo = makeRepo(query);
    await expect(repo.hardDeleteItem(21)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM cmkt_content_items/),
      [21],
    );
    expect(query).not.toHaveBeenCalledWith(expect.stringMatching(/UPDATE cmkt_audit_exports/), expect.anything());
  });
});
