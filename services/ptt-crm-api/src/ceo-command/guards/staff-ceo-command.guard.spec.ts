import { ForbiddenException } from '@nestjs/common';
import { StaffCeoCommandViewGuard } from './staff-ceo-command.guard';

function makeContext(req: object) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as never;
}

const ceoViewCaps = [{ section: 'ceo_command', action: 'view' }];

describe('StaffCeoCommandViewGuard', () => {
  it('resolves UUID JWT sub via resolveCrmStaffUserId', async () => {
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(99),
      me: jest.fn().mockResolvedValue({ caps: ceoViewCaps }),
    };
    const guard = new StaffCeoCommandViewGuard(staffAuth as never);

    await expect(
      guard.canActivate(
        makeContext({
          staffUser: { sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', email: 'ceo@ptt.vn' },
        }),
      ),
    ).resolves.toBe(true);

    expect(staffAuth.resolveCrmStaffUserId).toHaveBeenCalled();
  });

  it('403 ceo_unresolved_staff when staff cannot be resolved', async () => {
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(null),
      me: jest.fn(),
    };
    const guard = new StaffCeoCommandViewGuard(staffAuth as never);

    await expect(
      guard.canActivate(
        makeContext({
          staffUser: { sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', email: 'ghost@ptt.vn' },
        }),
      ),
    ).rejects.toMatchObject({ response: { error: 'ceo_unresolved_staff' } });

    expect(staffAuth.me).not.toHaveBeenCalled();
  });

  it('403 ceo_view_forbidden without view caps', async () => {
    const staffAuth = {
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(42),
      me: jest.fn().mockResolvedValue({ caps: [{ section: 'crm_leads', action: 'view' }] }),
    };
    const guard = new StaffCeoCommandViewGuard(staffAuth as never);

    await expect(
      guard.canActivate(makeContext({ staffUser: { sub: '42' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
