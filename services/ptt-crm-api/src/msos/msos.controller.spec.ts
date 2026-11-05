import { GUARDS_METADATA } from '@nestjs/common/constants';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { MSOS_REQUIRED_ACTION_KEY, StaffMsosGuard } from './guards/staff-msos.guard';
import { MsosController } from './msos.controller';

describe('MsosController', () => {
  const staffAuth = { resolveCrmStaffUserId: jest.fn().mockResolvedValue(9) };

  const makeController = (service: Record<string, unknown>) =>
    new MsosController(service as never, staffAuth as never);

  it('GET health calls assertEnabled before getHealth', () => {
    const service = {
      assertEnabled: jest.fn(),
      getHealth: jest.fn().mockReturnValue({ ok: true, reseller: false, connector_write: false }),
    };
    const c = makeController(service);
    const out = c.health();
    expect(service.assertEnabled).toHaveBeenCalled();
    expect(service.getHealth).toHaveBeenCalled();
    expect(out).toEqual({ ok: true, reseller: false, connector_write: false });
  });

  it('uses StaffOrInternalKeyGuard and StaffMsosGuard at controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, MsosController) ?? [];
    expect(guards).toEqual(expect.arrayContaining([StaffOrInternalKeyGuard, StaffMsosGuard]));
  });

  it('GET health requires crm_media view cap', () => {
    const action = Reflect.getMetadata(MSOS_REQUIRED_ACTION_KEY, MsosController.prototype.health);
    expect(action).toBe('view');
  });

  it('POST partners requires crm_media write cap', () => {
    const action = Reflect.getMetadata(MSOS_REQUIRED_ACTION_KEY, MsosController.prototype.createPartner);
    expect(action).toBe('write');
  });

  it('GET partners requires crm_media view cap', () => {
    const action = Reflect.getMetadata(MSOS_REQUIRED_ACTION_KEY, MsosController.prototype.listPartners);
    expect(action).toBe('view');
  });
});
