import { BadRequestException } from '@nestjs/common';
import { CpLaunchGateService } from './cp-launch-gate.service';
import { buildCpCreativeDescription } from './cp-launch-gate.util';

const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CREATIVE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VERSION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('CpLaunchGateService', () => {
  const config = { databaseUrl: 'postgres://local/test' } as never;

  it('allows launch when template does not require CP QC', async () => {
    const db = { query: jest.fn() };
    const service = new CpLaunchGateService(config);
    Object.defineProperty(service, 'db', { value: db });

    await expect(service.assertAdsLaunchAllowed({
      templateId: 're_traffic_warm',
      creativeId: CREATIVE_ID,
      clientId: CLIENT_ID,
    })).resolves.toBeUndefined();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('blocks launch when linked CP version QC is not passed', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            description: buildCpCreativeDescription(VERSION_ID),
            asset_url: 'file:///tmp/h1.mp4',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: VERSION_ID,
            qc_status: 'blocked',
            playbook_id: 'lead_social_916',
          }],
        }),
    };
    const service = new CpLaunchGateService(config);
    Object.defineProperty(service, 'db', { value: db });

    await expect(service.assertAdsLaunchAllowed({
      templateId: 're_lead_default',
      creativeId: CREATIVE_ID,
      clientId: CLIENT_ID,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows launch when linked CP version QC passed', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            description: buildCpCreativeDescription(VERSION_ID),
            asset_url: 'file:///tmp/h1.mp4',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: VERSION_ID,
            qc_status: 'passed',
            playbook_id: 'lead_social_916',
          }],
        }),
    };
    const service = new CpLaunchGateService(config);
    Object.defineProperty(service, 'db', { value: db });

    await expect(service.assertAdsLaunchAllowed({
      templateId: 're_lead_default',
      creativeId: CREATIVE_ID,
      clientId: CLIENT_ID,
    })).resolves.toBeUndefined();
  });
});
