import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService drafts', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const lineId = '00000000-0000-4000-8000-000000000060';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId, display_code: 'ML-20260912-A1B2' }),
      getDraftFacts: jest.fn().mockResolvedValue({
        display_code: 'ML-20260912-A1B2',
        io_qty: 300,
        rate_version: 2,
        report_qty: null,
      }),
      ...overrides,
    }) as unknown as MsosRepository;

  it('creates io draft without mutating', async () => {
    const getDraftFacts = jest.fn().mockResolvedValue({
      display_code: 'ML-20260912-A1B2',
      io_qty: 300,
      rate_version: 2,
      report_qty: null,
    });
    const repo = makeRepo({ getDraftFacts });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createDraft({ kind: 'io', media_line_id: lineId });
    expect(out.actor).toBe('template_a1');
    expect(out.text).toContain('300');
    expect(getDraftFacts).toHaveBeenCalledWith(lineId, 'io');
  });

  it('creates traffic draft', async () => {
    const repo = makeRepo({
      getDraftFacts: jest.fn().mockResolvedValue({
        display_code: 'ML-20260912-A1B2',
        traffic_status: 'submitted',
        click_url: 'https://example.com/landing',
      }),
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createDraft({ kind: 'traffic', media_line_id: lineId });
    expect(out.facts.traffic_status).toBe('submitted');
  });

  it('creates discrepancy draft', async () => {
    const repo = makeRepo({
      getDraftFacts: jest.fn().mockResolvedValue({
        display_code: 'ML-20260912-A1B2',
        io_qty: 300,
        report_qty: 282,
        material: true,
      }),
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createDraft({ kind: 'discrepancy', media_line_id: lineId });
    expect(out.text).toContain('282');
  });
});
