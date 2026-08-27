import { CrmConfigService } from './crm-config.service';
import { CrmConfigPgRepository } from './crm-config-pg.repository';

describe('CrmConfigService', () => {
  const repo = {
    listCustomFields: jest.fn(),
    getCustomField: jest.fn(),
    createCustomField: jest.fn(),
    updateCustomField: jest.fn(),
    deleteCustomField: jest.fn(),
    listPipelineStages: jest.fn(),
    createPipelineStage: jest.fn(),
    patchPipelineStage: jest.fn(),
    deletePipelineStage: jest.fn(),
    replacePipelineStages: jest.fn(),
    getSalesPipelineConfig: jest.fn(),
    listLeadLookups: jest.fn(),
    createLeadLookup: jest.fn(),
    updateLeadLookup: jest.fn(),
    deleteLeadLookup: jest.fn(),
  } as unknown as CrmConfigPgRepository;

  const service = new CrmConfigService(repo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns custom field by id', async () => {
    const field = { id: 1, field_key: 'budget', label: 'Ngân sách' };
    (repo.getCustomField as jest.Mock).mockResolvedValue(field);
    await expect(service.getCustomField(1)).resolves.toEqual(field);
    expect(repo.getCustomField).toHaveBeenCalledWith(1);
  });

  it('creates pipeline stage via repository', async () => {
    const stage = { stage_key: 'sql', label: 'SQL' };
    (repo.createPipelineStage as jest.Mock).mockResolvedValue(stage);
    await expect(service.createSalesPipelineStage({ label: 'SQL' })).resolves.toEqual(stage);
    expect(repo.createPipelineStage).toHaveBeenCalledWith('sales', { label: 'SQL' });
  });

  it('patches pipeline stage by key', async () => {
    const stage = { stage_key: 'sql', label: 'SQL qualified' };
    (repo.patchPipelineStage as jest.Mock).mockResolvedValue(stage);
    await expect(service.patchSalesPipelineStage('sql', { label: 'SQL qualified' })).resolves.toEqual(stage);
    expect(repo.patchPipelineStage).toHaveBeenCalledWith('sales', 'sql', { label: 'SQL qualified' });
  });
});
