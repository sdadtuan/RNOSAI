import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService evidence packs', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const lineId = '00000000-0000-4000-8000-000000000060';
  const packId = '00000000-0000-4000-8000-000000000080';
  const evidenceId = '00000000-0000-4000-8000-000000000090';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository =>
    ({
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId }),
      createEvidence: jest.fn(),
      createEvidencePack: jest.fn(),
      getEvidencePack: jest.fn(),
      addEvidencePackItem: jest.fn(),
      getEvidencePackItems: jest.fn(),
      markEvidencePackOfficial: jest.fn(),
      ...overrides,
    }) as unknown as MsosRepository;

  it('creates evidence row', async () => {
    const createEvidence = jest.fn().mockResolvedValue({
      id: evidenceId,
      display_code: 'EV-20260912-A1B2',
      hash: 'abc123',
    });
    const svc = new MsosService(enabledConfig, makeRepo({ createEvidence }));
    const out = await svc.createEvidence({
      media_line_id: lineId,
      source: 'partner_report',
      hash: 'abc123',
      captured_at: '2026-09-12T10:00:00Z',
    });
    expect(out.hash).toBe('abc123');
  });

  it('creates evidence pack for media line', async () => {
    const createEvidencePack = jest.fn().mockResolvedValue({
      id: packId,
      display_code: 'EP-20260912-A1B2',
      status: 'draft',
    });
    const svc = new MsosService(enabledConfig, makeRepo({ createEvidencePack }));
    const out = await svc.createEvidencePack({ media_line_id: lineId });
    expect(out.status).toBe('draft');
  });

  it('adds evidence item to pack', async () => {
    const addEvidencePackItem = jest.fn().mockResolvedValue(undefined);
    const repo = makeRepo({
      getEvidencePack: jest.fn().mockResolvedValue({ id: packId, status: 'draft' }),
      addEvidencePackItem,
    });
    const svc = new MsosService(enabledConfig, repo);
    await svc.addEvidencePackItem(packId, evidenceId);
    expect(addEvidencePackItem).toHaveBeenCalledWith(packId, evidenceId);
  });

  it('official pack requires fresh hashed evidence', async () => {
    const markEvidencePackOfficial = jest.fn().mockResolvedValue({
      id: packId,
      status: 'official',
    });
    const repo = makeRepo({
      getEvidencePack: jest.fn().mockResolvedValue({ id: packId, status: 'draft', media_line_id: lineId }),
      getEvidencePackItems: jest.fn().mockResolvedValue([
        {
          hash: 'abc123',
          source: 'partner_report',
          captured_at: new Date().toISOString(),
        },
      ]),
      markEvidencePackOfficial,
    });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.officialEvidencePack(packId);
    expect(out.status).toBe('official');
  });

  it('official pack fails when evidence stale or missing hash', async () => {
    const repo = makeRepo({
      getEvidencePack: jest.fn().mockResolvedValue({ id: packId, status: 'draft' }),
      getEvidencePackItems: jest.fn().mockResolvedValue([
        { hash: null, source: 'partner_report', captured_at: '2026-09-01T00:00:00Z' },
      ]),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.officialEvidencePack(packId)).rejects.toMatchObject({
      response: { error: 'evidence_not_official_ready' },
    });
  });
});
