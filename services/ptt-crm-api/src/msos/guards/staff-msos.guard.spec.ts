import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import catalog from '../../staff-permissions/rbac-admin-catalog.json';
import { MSOS_REQUIRED_ACTION_KEY, StaffMsosGuard } from './staff-msos.guard';

function parseCaps(caps: string[]): Array<{ section: string; action: string }> {
  return caps.map((cap) => {
    const [section, action] = cap.split(':');
    return { section, action };
  });
}

function ctx(
  opts: { staffId: number; caps: string[]; staffAuthVia?: 'internal' | 'jwt' },
  action: 'view' | 'write' | 'publish' | 'finance_request' | 'admin' = 'view',
) {
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn().mockResolvedValue(opts.staffId),
    me: jest.fn().mockResolvedValue({ caps: parseCaps(opts.caps) }),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, capAction: string) =>
      caps.some((c) => c.section === section && c.action === capAction),
    ),
  };
  const reflector = {
    get: jest.fn((key: string) => (key === MSOS_REQUIRED_ACTION_KEY ? action : undefined)),
  };
  const guard = new StaffMsosGuard(staffAuth as never, reflector as unknown as Reflector);
  const executionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        staffUser: opts.staffAuthVia === 'internal' ? undefined : { sub: String(opts.staffId) },
        staffAuthVia: opts.staffAuthVia,
      }),
    }),
    getHandler: () => ({}),
  } as never;
  return { guard, executionContext, staffAuth };
}

describe('rbac catalog crm_media', () => {
  it('declares crm_media capabilities', () => {
    expect(catalog.section_actions.crm_media).toEqual(
      expect.arrayContaining(['view', 'write', 'publish', 'finance_request', 'admin']),
    );
  });

  it('registers Media OS metadata', () => {
    const entry = catalog.sections.find((s) => s.id === 'crm_media');
    expect(entry).toMatchObject({
      id: 'crm_media',
      label: 'Media OS',
      page: '/crm/media-os',
      group: 'CRM',
    });
  });
});

describe('StaffMsosGuard', () => {
  it('passes internal key bypass', async () => {
    const { guard, executionContext } = ctx({ staffId: 0, caps: [], staffAuthVia: 'internal' });
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('denies staffId<=0', async () => {
    const { guard, executionContext } = ctx({ staffId: 0, caps: ['crm_media:view'] });
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403 });
  });

  it('allows view with crm_media:view', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_media:view'] });
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('defaults action to view', async () => {
    const { guard, executionContext, staffAuth } = ctx({ staffId: 3, caps: ['crm_media:view'] });
    await guard.canActivate(executionContext);
    expect(staffAuth.hasCap).toHaveBeenCalledWith(expect.anything(), 'crm_media', 'view');
  });

  it('denies write without crm_media:write', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_media:view'] }, 'write');
    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({
      status: 403,
      response: { error: 'missing_cap', section: 'crm_media', action: 'write' },
    });
  });

  it('allows publish with crm_media:publish', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_media:publish'] }, 'publish');
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('allows finance_request with crm_media:finance_request', async () => {
    const { guard, executionContext } = ctx(
      { staffId: 3, caps: ['crm_media:finance_request'] },
      'finance_request',
    );
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('throws ForbiddenException for missing cap', async () => {
    const { guard, executionContext } = ctx({ staffId: 3, caps: ['crm_leads:view'] }, 'write');
    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
