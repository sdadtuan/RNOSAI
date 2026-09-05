import { DEFAULT_WEIGHTS } from './am.types';
import { AmSettingsService } from './am-settings.service';

const VALID_BANDS = {
  healthy: [80, 100] as [number, number],
  watch: [60, 79] as [number, number],
  at_risk: [40, 59] as [number, number],
  critical: [0, 39] as [number, number],
};

describe('AmSettingsService.publish', () => {
  const repo = {
    load: jest.fn(),
    save: jest.fn(),
  };
  const audit = { insert: jest.fn() };
  let service: AmSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AmSettingsService(repo as never, audit as never);
  });

  it('rejects weights 29/20/20/15/15 with 400 weights_sum and does not UPDATE', async () => {
    await expect(
      service.publish(
        {
          weights: {
            kpi_delivery: 29,
            engagement: 20,
            financial: 20,
            satisfaction: 15,
            contract_support: 15,
          },
          bands: VALID_BANDS,
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'weights_sum' });
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.insert).not.toHaveBeenCalled();
  });

  it('rejects overlapping bands with 400 bands_overlap and does not UPDATE', async () => {
    await expect(
      service.publish(
        {
          weights: { ...DEFAULT_WEIGHTS },
          bands: {
            healthy: [80, 100],
            watch: [60, 80],
            at_risk: [40, 59],
            critical: [0, 39],
          },
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'bands_overlap' });
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.insert).not.toHaveBeenCalled();
  });
});
