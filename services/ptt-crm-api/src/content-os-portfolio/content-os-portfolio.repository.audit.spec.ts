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

  it('listAuditActivity unions item versions, publication logs, and SLA events — not only export rows', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          actor: 'editor@ptt.vn',
          action: 'manual',
          entity: 'item_version',
          created_at: '2026-09-10T08:00:00.000Z',
          item_id: 21,
          id: 9,
        },
      ],
    });
    const repo = makeRepo(query);
    await expect(repo.listAuditActivity([4])).resolves.toEqual([
      {
        actor: 'editor@ptt.vn',
        action: 'manual',
        entity: 'item_version',
        created_at: '2026-09-10T08:00:00.000Z',
        item_id: 21,
        id: 9,
      },
    ]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/cmkt_content_item_versions/);
    expect(sql).toMatch(/cmkt_publication_logs/);
    expect(sql).toMatch(/cmkt_sla_events/);
    expect(sql).toMatch(/cmkt_audit_exports/);
    expect(sql).not.toMatch(/body_json|prompt|token/i);
    expect(query).toHaveBeenCalledWith(expect.any(String), [[4]]);
  });

  it('listAuditActivity SQL mentions cmkt_audit_exports as a fourth UNION arm', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = makeRepo(query);
    await repo.listAuditActivity([4]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/UNION ALL[\s\S]*cmkt_audit_exports/);
    expect(sql.match(/UNION ALL/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('listAuditActivity skips cmkt_audit_exports when that table is missing instead of emptying other arms', async () => {
    const missing = Object.assign(new Error('relation "cmkt_audit_exports" does not exist'), {
      code: '42P01',
    });
    const query = jest
      .fn()
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce({
        rows: [
          {
            actor: 'editor@ptt.vn',
            action: 'manual',
            entity: 'item_version',
            created_at: '2026-09-10T08:00:00.000Z',
            item_id: 21,
            id: 9,
          },
        ],
      });
    const repo = makeRepo(query);
    await expect(repo.listAuditActivity([4])).resolves.toEqual([
      {
        actor: 'editor@ptt.vn',
        action: 'manual',
        entity: 'item_version',
        created_at: '2026-09-10T08:00:00.000Z',
        item_id: 21,
        id: 9,
      },
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[0][0])).toMatch(/cmkt_audit_exports/);
    expect(String(query.mock.calls[1][0])).not.toMatch(/cmkt_audit_exports/);
    expect(String(query.mock.calls[1][0])).toMatch(/cmkt_content_item_versions/);
  });

  it('hardDeleteItem deletes atomically with legal_hold and writes an audit event when a row is removed', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ outcome: 'deleted', id: 21 }],
    });
    const repo = makeRepo(query);
    await expect(
      repo.hardDeleteItem({ itemId: 21, actor: 'admin@ptt.vn', lifecycleIds: [4] }),
    ).resolves.toBe('deleted');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM cmkt_content_items/);
    expect(sql).toMatch(/legal_hold IS NOT TRUE/);
    expect(sql).toMatch(/INSERT INTO cmkt_audit_exports/);
    expect(sql).toMatch(/hard_delete/);
    expect(params).toEqual([21, 'admin@ptt.vn', [4]]);
  });

  it('hardDeleteItem reports held without a prior GET when the row exists on legal hold', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ outcome: 'held', id: 21 }],
    });
    const repo = makeRepo(query);
    await expect(
      repo.hardDeleteItem({ itemId: 21, actor: 'admin@ptt.vn', lifecycleIds: [4] }),
    ).resolves.toBe('held');
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toMatch(/DELETE FROM cmkt_content_items/);
    expect(String(query.mock.calls[0][0])).not.toMatch(/^SELECT /);
  });
});
