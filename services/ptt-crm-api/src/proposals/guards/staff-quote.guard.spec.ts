import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  QT_REQUIRED_ACTION_KEY,
  QT_REQUIRED_SECTION_KEY,
  StaffQuoteGuard,
} from './staff-quote.guard';

function makeContext(req: object) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
  } as never;
}

const quoteViewCaps = [{ section: 'crm_quote', action: 'view' }];

function hasCap(
  caps: Array<{ section: string; action: string }>,
  section: string,
  action: string,
) {
  return caps.some((c) => c.section === section && c.action === action);
}

describe('StaffQuoteGuard', () => {
  it('resolves UUID JWT sub via resolveCrmStaffUserId', async () => {
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(99),
      me: jest.fn().mockResolvedValue({ caps: quoteViewCaps }),
      hasCap: jest.fn(hasCap),
    };
    const reflector = { get: jest.fn(() => undefined) };
    const guard = new StaffQuoteGuard(staffAuth as never, reflector as unknown as Reflector);

    await expect(
      guard.canActivate(
        makeContext({
          staffUser: { sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', email: 'quote@ptt.vn' },
        }),
      ),
    ).resolves.toBe(true);

    expect(staffAuth.resolveCrmStaffUserId).toHaveBeenCalled();
  });

  it('403 qt_unresolved_staff when staff cannot be resolved', async () => {
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(null),
      me: jest.fn(),
      hasCap: jest.fn(hasCap),
    };
    const reflector = { get: jest.fn(() => undefined) };
    const guard = new StaffQuoteGuard(staffAuth as never, reflector as unknown as Reflector);

    await expect(
      guard.canActivate(
        makeContext({
          staffUser: { sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', email: 'ghost@ptt.vn' },
        }),
      ),
    ).rejects.toMatchObject({ response: { error: 'qt_unresolved_staff' } });

    expect(staffAuth.me).not.toHaveBeenCalled();
  });

  it('403 missing_cap without crm_quote.finance on BLD-05 route', async () => {
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(42),
      me: jest.fn().mockResolvedValue({ caps: quoteViewCaps }),
      hasCap: jest.fn(hasCap),
    };
    const reflector = {
      get: jest.fn((key: string) => {
        if (key === QT_REQUIRED_SECTION_KEY) return 'crm_quote.finance';
        if (key === QT_REQUIRED_ACTION_KEY) return 'view';
        return undefined;
      }),
    };
    const guard = new StaffQuoteGuard(staffAuth as never, reflector as unknown as Reflector);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '42' } })),
    ).rejects.toMatchObject({
      response: { error: 'missing_cap', section: 'crm_quote.finance', action: 'view' },
    });
    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '42' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
