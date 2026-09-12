import { NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

describe('MsosService', () => {
  const repo = {} as MsosRepository;

  it('throws media_os_disabled when flag off', () => {
    const svc = new MsosService({ mediaOsEnabled: false } as AppConfigService, repo);
    expect(() => svc.assertEnabled()).toThrow(NotFoundException);
    try {
      svc.assertEnabled();
    } catch (e) {
      expect((e as NotFoundException).getResponse()).toEqual({ error: 'media_os_disabled' });
    }
  });

  it('passes when flag on', () => {
    const svc = new MsosService({ mediaOsEnabled: true } as AppConfigService, repo);
    expect(() => svc.assertEnabled()).not.toThrow();
  });

  it('getHealth returns flags from config', () => {
    const svc = new MsosService(
      {
        mediaOsEnabled: true,
        mediaOsReseller: false,
        mediaOsConnectorWrite: false,
      } as AppConfigService,
      repo,
    );
    expect(svc.getHealth()).toEqual({ ok: true, reseller: false, connector_write: false });
  });
});
