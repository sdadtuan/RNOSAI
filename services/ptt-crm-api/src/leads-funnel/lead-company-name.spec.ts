import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';

describe('getLeadCompanyName', () => {
  it('reads the company by sqlite_lead_id', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ company_name: 'Quý Nguyễn Studio', meta_json: { company_name: 'Meta Co' } }],
    });
    const repo = new LeadsFunnelPgRepository({ databaseUrl: 'postgres://unused' } as never);
    (repo as unknown as { pool: { query: typeof query } }).pool = { query };

    await expect(repo.getLeadCompanyName(900000024)).resolves.toBe('Quý Nguyễn Studio');
    expect(String(query.mock.calls[0][0])).toContain('sqlite_lead_id');
    expect(query.mock.calls[0][1]).toEqual([900000024]);
  });

  it('uses the company stored on the lead meta when the column is empty', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ company_name: '', meta_json: { company: 'Seo Studio' } }],
    });
    const repo = new LeadsFunnelPgRepository({ databaseUrl: 'postgres://unused' } as never);
    (repo as unknown as { pool: { query: typeof query } }).pool = { query };

    await expect(repo.getLeadCompanyName(900000024)).resolves.toBe('Seo Studio');
  });
});
