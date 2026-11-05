import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffCsdGuard, CSD_REQUIRED_ACTION_KEY } from './staff-csd.guard';

function parseCaps(caps: string[]): Array<{ section: string; action: string }> {
  return caps.map((cap) => {
    const [section, action] = cap.split(':');
    return { section, action };
  });
}

function ctx(
  opts: { staffId: number; caps: string[] },
  action: 'view' | 'write' | 'assign' | 'manage' | 'admin' = 'view',
) {
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(opts.staffId <= 0 ? opts.staffId : opts.staffId),
    me: jest.fn().mockResolvedValue({ caps: parseCaps(opts.caps) }),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, capAction: string) =>
      caps.some((c) => c.section === section && c.action === capAction),
    ),
  };
  const reflector = {
    get: jest.fn((key: string) => (key === CSD_REQUIRED_ACTION_KEY ? action : undefined)),
  };
  const guard = new StaffCsdGuard(staffAuth as never, reflector as unknown as Reflector);
  const executionContext = {
    switchToHttp: () => ({
      getRequest: () => ({ staffUser: { sub: String(opts.staffId) } }),
    }),
    getHandler: () => ({}),
  } as never;
  return { guard, executionContext, staffAuth };
}

describe('StaffCsdGuard', () => {
  it('denies staffId<=0', async () => {
    const { guard, executionContext } = ctx({ staffId: 0, caps: ['csd:view'] });
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });

  it('allows view with csd:view', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['csd:view'] });
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('denies write without csd:write', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['csd:view'] }, 'write');
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });

  it('allows write with csd:write', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['csd:view', 'csd:write'] }, 'write');
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('throws ForbiddenException for missing cap', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_leads:view'] }, 'write');
    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
