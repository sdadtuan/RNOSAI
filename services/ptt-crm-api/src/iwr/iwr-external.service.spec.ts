import { ForbiddenException } from '@nestjs/common';
import { IwrExternalService } from './iwr-external.service';
import type { IwrActor } from './iwr.types';

describe('IwrExternalService', () => {
  const actor: IwrActor = {
    staffId: 5,
    staffLabel: 'AM',
    departmentId: 1,
    caps: [{ section: 'iwr', action: 'external' }],
  };

  it('requestShare rejects gmail not on allowlist', async () => {
    process.env.PTT_IWR_EXTERNAL_EMAIL_ALLOWLIST = 'client.com';
    const svc = new IwrExternalService(
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      { insert: jest.fn() } as never,
    );
    await expect(
      svc.requestShare(actor, 'r1', 'user@gmail.com', 2),
    ).rejects.toMatchObject({ response: { error: 'iwr_external_not_allowlisted' } });
  });

  it('requestShare requires external cap', async () => {
    const svc = new IwrExternalService(
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      { insert: jest.fn() } as never,
    );
    const noCap: IwrActor = {
      staffId: 1,
      staffLabel: 'x',
      departmentId: null,
      caps: [{ section: 'iwr', action: 'view' }],
    };
    await expect(
      svc.requestShare(noCap, 'r1', 'a@client.com', 2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
