import { RawLeadHarvestRepository } from './raw-lead-harvest.repository';
import { parseRawLeadListQuery } from './raw-lead-list-query.util';

describe('RawLeadHarvestRepository.listLeadsPage', () => {
  it('runs COUNT then SELECT with LIMIT/OFFSET and has_phone filter', async () => {
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, ' ');
      if (s.includes('CREATE') || s.includes('ALTER') || s.includes('CREATE INDEX')) {
        return { rows: [] };
      }
      if (s.includes('COUNT(*)')) {
        expect(s).toContain('phone_norm IS NOT NULL');
        return { rows: [{ n: 51 }] };
      }
      if (s.includes('LIMIT') && s.includes('OFFSET')) {
        expect(params[params.length - 2]).toBe(50);
        expect(params[params.length - 1]).toBe(50); // page 2
        return {
          rows: [
            {
              id: 2,
              project_id: 9,
              job_id: 1,
              company_name: 'Spa B',
              address: null,
              phone: null,
              phone_norm: '0901',
              email: null,
              contact_title: null,
              website: null,
              fanpage_url: null,
              zalo_url: null,
              evidence_url: null,
              evidence_snippet: null,
              source_provider: null,
              source_model: null,
              search_source_keys: [],
              search_channel_keys: [],
              quality_score: 40,
              icp_fit_score: 40,
              contactable: true,
              status: 'pending',
              verify_json: {},
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const repo = new RawLeadHarvestRepository({ databaseUrl: 'postgres://x' } as never);
    Object.defineProperty(repo, 'db', { get: () => ({ query }) });

    const parsed = parseRawLeadListQuery({
      page: '2',
      page_size: '50',
      has_phone: '1',
      include_auto_rejected: '1',
    });
    const out = await repo.listLeadsPage(9, parsed);
    expect(out.total).toBe(51);
    expect(out.leads).toHaveLength(1);
    expect(out.leads[0].company_name).toBe('Spa B');
  });
});
