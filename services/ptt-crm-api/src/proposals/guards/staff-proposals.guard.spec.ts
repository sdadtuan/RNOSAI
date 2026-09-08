import { ForbiddenException } from '@nestjs/common';
import { StaffProposalsViewGuard, StaffProposalsWriteGuard } from './staff-proposals.guard';

function makeContext(req: object) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as never;
}

function mockAuth(caps: Array<{ section: string; action: string }>) {
  return {
    me: jest.fn().mockResolvedValue({ caps }),
    hasCap: jest.fn(
      (c: Array<{ section: string; action: string }>, section: string, action: string) =>
        c.some((x) => x.section === section && x.action === action),
    ),
  };
}

describe('StaffProposalsViewGuard', () => {
  it('allows view with crm_quote.view', async () => {
    const staffAuth = mockAuth([{ section: 'crm_quote', action: 'view' }]);
    const guard = new StaffProposalsViewGuard(staffAuth as never);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '1' } })),
    ).resolves.toBe(true);
  });

  it('allows view with crm_board.view compat', async () => {
    const staffAuth = mockAuth([{ section: 'crm_board', action: 'view' }]);
    const guard = new StaffProposalsViewGuard(staffAuth as never);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '1' } })),
    ).resolves.toBe(true);
  });

  it('denies view without crm_quote.view or crm_board.view', async () => {
    const staffAuth = mockAuth([{ section: 'crm_leads', action: 'view' }]);
    const guard = new StaffProposalsViewGuard(staffAuth as never);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('StaffProposalsWriteGuard', () => {
  it('allows write with crm_quote.edit', async () => {
    const staffAuth = mockAuth([{ section: 'crm_quote', action: 'edit' }]);
    const guard = new StaffProposalsWriteGuard(staffAuth as never);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '1' } })),
    ).resolves.toBe(true);
  });

  it('allows write with crm_board.edit compat', async () => {
    const staffAuth = mockAuth([{ section: 'crm_board', action: 'edit' }]);
    const guard = new StaffProposalsWriteGuard(staffAuth as never);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '1' } })),
    ).resolves.toBe(true);
  });

  it('denies write without crm_quote.edit or crm_board.edit', async () => {
    const staffAuth = mockAuth([{ section: 'crm_quote', action: 'view' }]);
    const guard = new StaffProposalsWriteGuard(staffAuth as never);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
