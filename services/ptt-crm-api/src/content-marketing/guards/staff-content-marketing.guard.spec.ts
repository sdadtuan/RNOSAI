import { ForbiddenException } from '@nestjs/common';
import { StaffContentMarketingViewGuard } from './staff-content-marketing.guard';

function guardWithCaps(caps: Array<{ section: string; action: string }>) {
  const staffAuth = {
    me: jest.fn().mockResolvedValue({ caps }),
    hasCap: jest.fn((userCaps: typeof caps, section: string, action: string) =>
      userCaps.some((c) => c.section === section && c.action === action),
    ),
  };
  return new StaffContentMarketingViewGuard(staffAuth as never);
}

function ctx() {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ staffUser: { sub: '1' }, staffAuthVia: 'jwt' }),
    }),
  } as never;
}

describe('StaffContentMarketingViewGuard', () => {
  it('allows crm_content.view without crm_board.view', async () => {
    const guard = guardWithCaps([{ section: 'crm_content', action: 'view' }]);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });

  it('denies when no content OS cap', async () => {
    const guard = guardWithCaps([{ section: 'crm_board', action: 'view' }]);
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
