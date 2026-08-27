import { AppConfigService } from '../config/app-config.service';
import { LeadsFunnelPgRepository } from '../leads-funnel/leads-funnel-pg.repository';
import { LeadsRepository } from './leads.repository';
import { PgLeadsRepository } from './pg-leads.repository';

describe('LeadsRepository', () => {
  it('serves list and detail reads from PostgreSQL only', async () => {
    const config = {
      crmLeadsFunnelNest: false,
    } as AppConfigService;
    const pgRepo = {
      listLeads: jest.fn().mockResolvedValue({ leads: [], total: 0 }),
      getLeadById: jest.fn().mockResolvedValue(null),
    } as unknown as PgLeadsRepository;
    const repository = new LeadsRepository(
      config,
      pgRepo,
      undefined as unknown as LeadsFunnelPgRepository,
    );

    await repository.listLeads({ limit: 25 });
    await repository.getLeadById(42);

    expect(pgRepo.listLeads).toHaveBeenCalledWith({ limit: 25 });
    expect(pgRepo.getLeadById).toHaveBeenCalledWith(42);
  });
});
