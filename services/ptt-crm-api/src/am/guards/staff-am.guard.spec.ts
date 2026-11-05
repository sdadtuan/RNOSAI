import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AmController } from '../am.controller';
import {
  AM_REQUIRED_ACTION_KEY,
  AM_REQUIRED_ANY_ACTION_KEY,
  AM_REQUIRED_SECTION_KEY,
  StaffAmGuard,
} from './staff-am.guard';

function parseCaps(caps: string[]): Array<{ section: string; action: string }> {
  return caps.map((cap) => {
    const [section, action] = cap.split(':');
    return { section, action };
  });
}

function ctx(
  opts: { staffId: number; caps: string[]; internal?: boolean },
  action: 'view' | 'view_all' | 'edit' | 'assign' | 'manage' | Array<'view' | 'view_all' | 'edit' | 'assign' | 'manage'> = 'view',
  section: 'crm_am' | 'crm_am.finance' = 'crm_am',
) {
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(opts.staffId <= 0 ? opts.staffId : opts.staffId),
    me: jest.fn().mockResolvedValue({ caps: parseCaps(opts.caps) }),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, capSection: string, capAction: string) =>
      caps.some((c) => c.section === capSection && c.action === capAction),
    ),
  };
  const reflector = {
    get: jest.fn((key: string) => {
      if (key === AM_REQUIRED_ANY_ACTION_KEY) return Array.isArray(action) ? action : undefined;
      if (key === AM_REQUIRED_ACTION_KEY) return Array.isArray(action) ? undefined : action;
      if (key === AM_REQUIRED_SECTION_KEY) return section;
      return undefined;
    }),
  };
  const guard = new StaffAmGuard(staffAuth as never, reflector as unknown as Reflector);
  const executionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        staffUser: opts.internal ? undefined : { sub: String(opts.staffId) },
        staffAuthVia: opts.internal ? 'internal' : 'jwt',
      }),
    }),
    getHandler: () => ({}),
  } as never;
  return { guard, executionContext, staffAuth };
}

describe('StaffAmGuard', () => {
  it('denies staffId<=0', async () => {
    const { guard, executionContext } = ctx({ staffId: 0, caps: ['crm_am:view'] });
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });

  it('allows view with crm_am:view', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_am:view'] });
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('allows view with crm_am:view_all', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_am:view_all'] });
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('denies edit without crm_am:edit', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_am:view'] }, 'edit');
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });

  it('denies assign without crm_am:assign (view user 403)', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_am:view'] }, 'assign');
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });

  it('allows assign with crm_am:manage', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_am:manage'] }, 'assign');
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('allows edit with crm_am:edit', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_am:view', 'crm_am:edit'] }, 'edit');
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('throws ForbiddenException for missing cap', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_leads:view'] }, 'edit');
    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows internal key without caps', async () => {
    const { guard, executionContext } = ctx({ staffId: 0, caps: [], internal: true });
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('PUT settings metadata action is manage so view-only cannot pass the guard', () => {
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, AmController.prototype.putSettings)).toBe(
      'manage',
    );
  });

  it('allows manage-only on edit-or-manage metadata and still denies a normal edit route', async () => {
    const anyOk = ctx({ staffId: 3, caps: ['crm_am:manage'] }, ['edit', 'manage']);
    await expect(anyOk.guard.canActivate(anyOk.executionContext)).resolves.toBe(true);

    const editDenied = ctx({ staffId: 3, caps: ['crm_am:manage'] }, 'edit');
    await expect(editDenied.guard.canActivate(editDenied.executionContext)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('delegation create and cancel require edit or manage, not edit alone', () => {
    expect(Reflect.getMetadata(AM_REQUIRED_ANY_ACTION_KEY, AmController.prototype.createDelegation)).toEqual([
      'edit',
      'manage',
    ]);
    expect(Reflect.getMetadata(AM_REQUIRED_ANY_ACTION_KEY, AmController.prototype.cancelDelegation)).toEqual([
      'edit',
      'manage',
    ]);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, AmController.prototype.createDelegation)).toBeUndefined();
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, AmController.prototype.putSettings)).toBe('manage');
  });

  it('checks crm_am.finance for finance endpoints', async () => {
    const { guard, executionContext } = ctx(
      { staffId: 3, caps: ['crm_am:view'] },
      'view',
      'crm_am.finance',
    );
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });

    const ok = ctx({ staffId: 3, caps: ['crm_am.finance:view'] }, 'view', 'crm_am.finance');
    await expect(ok.guard.canActivate(ok.executionContext)).resolves.toBe(true);
  });
});
