import { UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService outcome links', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const lineId = '00000000-0000-4000-8000-000000000060';
  const leadId = '00000000-0000-4000-8000-000000000070';

  const makeRepo = (overrides: Partial<MsosRepository> = {}): MsosRepository => {
    const sqls: string[] = [];
    const db = {
      query: jest.fn(async (sql: string) => {
        sqls.push(sql);
        if (/FROM leads/i.test(sql)) {
          return { rows: [{ id: leadId }] };
        }
        return { rows: [] };
      }),
      sqls,
    };
    return {
      db,
      listOutcomeLinks: jest.fn().mockResolvedValue([]),
      createOutcomeLink: jest.fn(),
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId }),
      ...overrides,
    } as unknown as MsosRepository;
  };

  it('lists empty outcome links', async () => {
    const repo = makeRepo();
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.listOutcomeLinks()).resolves.toEqual([]);
  });

  it('creates unmatched link when no lead_id', async () => {
    const createOutcomeLink = jest.fn().mockResolvedValue({
      id: 'ol1',
      display_code: 'OL-20260912-A1B2',
      media_line_id: lineId,
      lead_id: null,
      match_status: 'unmatched',
    });
    const repo = makeRepo({ createOutcomeLink });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createOutcomeLink({
      media_line_id: lineId,
      model: 'last_touch',
    });
    expect(out.match_status).toBe('unmatched');
    expect(createOutcomeLink).toHaveBeenCalledWith(
      expect.objectContaining({ match_status: 'unmatched', lead_id: null }),
    );
  });

  it('requires existing lead and never inserts leads', async () => {
    const sqls: string[] = [];
    const db = {
      query: jest.fn(async (sql: string) => {
        sqls.push(sql);
        return { rows: [] };
      }),
    };
    const createOutcomeLink = jest.fn();
    const repo = makeRepo({ db: db as unknown as MsosRepository['db'], createOutcomeLink });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.createOutcomeLink({ media_line_id: lineId, lead_id: leadId }),
    ).rejects.toMatchObject({ response: { error: 'lead_not_found' } });
    expect(sqls.join(' ')).toMatch(/SELECT/i);
    expect(sqls.join(' ')).not.toMatch(/INSERT INTO leads/i);
    expect(createOutcomeLink).not.toHaveBeenCalled();
  });

  it('creates matched link when lead exists', async () => {
    const createOutcomeLink = jest.fn().mockResolvedValue({
      id: 'ol2',
      display_code: 'OL-20260912-B2C3',
      media_line_id: lineId,
      lead_id: leadId,
      match_status: 'matched',
    });
    const repo = makeRepo({ createOutcomeLink });
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createOutcomeLink({
      media_line_id: lineId,
      lead_id: leadId,
    });
    expect(out.match_status).toBe('matched');
    expect(out.lead_id).toBe(leadId);
  });

  it('422 when media line missing', async () => {
    const repo = makeRepo({
      getMediaLine: jest.fn().mockResolvedValue(null),
    });
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.createOutcomeLink({ media_line_id: lineId }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
