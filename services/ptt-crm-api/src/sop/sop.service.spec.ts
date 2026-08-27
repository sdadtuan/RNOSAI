import { AppConfigService } from '../config/app-config.service';
import { SopPgRepository } from './sop-pg.repository';
import { SopService } from './sop.service';

describe('SopService', () => {
  it('lists templates from PostgreSQL regardless of the legacy feature flag', async () => {
    const pg = {
      listTemplates: jest.fn().mockResolvedValue([{ id: 1, name: 'Launch' }]),
    } as unknown as SopPgRepository;
    const config = {
      crmSopPg: false,
    } as AppConfigService;
    const service = new SopService(pg, config);

    await expect(service.listTemplates()).resolves.toEqual({
      templates: [{ id: 1, name: 'Launch' }],
    });
    expect(pg.listTemplates).toHaveBeenCalledWith(false);
  });

  it('lists runs from PostgreSQL with the normalized default status', async () => {
    const pg = {
      isValidRunStatus: jest.fn().mockReturnValue(true),
      listRuns: jest.fn().mockResolvedValue([{ id: 7, name: 'Launch SOP' }]),
    } as unknown as SopPgRepository;
    const config = {} as AppConfigService;
    const service = new SopService(pg, config);

    await expect(service.listRuns()).resolves.toEqual({
      runs: [{ id: 7, name: 'Launch SOP' }],
    });
    expect(pg.isValidRunStatus).toHaveBeenCalledWith('active');
    expect(pg.listRuns).toHaveBeenCalledWith('active');
  });
});
