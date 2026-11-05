import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IMG_REQUIRED_ACTION_KEY,
  IMG_REQUIRED_SECTION_KEY,
  StaffImgGuard,
} from './staff-img.guard';

function makeContext(caps: Array<{ section: string; action: string }>) {
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(42),
    me: jest.fn().mockResolvedValue({ caps }),
    hasCap: jest.fn(
      (userCaps: Array<{ section: string; action: string }>, section: string, action: string) =>
        userCaps.some((cap) => cap.section === section && cap.action === action),
    ),
  };
  const reflector = {
    get: jest.fn((key: string) => {
      if (key === IMG_REQUIRED_SECTION_KEY) return 'crm_img';
      if (key === IMG_REQUIRED_ACTION_KEY) return 'view';
      return undefined;
    }),
  };
  const guard = new StaffImgGuard(staffAuth as never, reflector as unknown as Reflector);
  const req = { staffUser: { sub: 'staff-1' }, staffAuthVia: 'jwt' as const };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
  return { guard, ctx, staffAuth };
}

describe('StaffImgGuard', () => {
  it('rejects missing crm_img.view', async () => {
    const { guard, ctx } = makeContext([{ section: 'crm_cp', action: 'view' }]);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { error: 'missing_cap', section: 'crm_img' },
    });
  });

  it('allows crm_img.view', async () => {
    const { guard, ctx } = makeContext([{ section: 'crm_img', action: 'view' }]);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows internal auth bypass', async () => {
    const { guard, ctx } = makeContext([]);
    const req = ctx.switchToHttp().getRequest() as { staffAuthVia?: string };
    req.staffAuthVia = 'internal';
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
