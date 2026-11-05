import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IntakeController } from './intake.controller';
import { StaffIntakeViewGuard, StaffIntakeWriteGuard } from './guards/staff-intake.guard';

describe('IntakeController actorContext', () => {
  it('treats unresolved JWT staff as empty-cap actor, not internal', async () => {
    const staffAuth = {
      me: jest.fn().mockResolvedValue({ caps: [], position_code: null }),
      resolveCrmStaffUserId: jest.fn().mockResolvedValue(null),
    };
    const ctrl = new IntakeController({} as never, staffAuth as never, {} as never, {} as never, {} as never);
    const actor = await (
      ctrl as unknown as {
        actorContext: (req: { staffAuthVia?: string; staffUser?: { sub: string } }) => Promise<unknown>;
      }
    ).actorContext({ staffAuthVia: 'jwt', staffUser: { sub: 'ghost@ptt.vn' } });
    expect(actor).toEqual({ staffId: 0, caps: [] });
  });

  it('keeps internal key as trusted null actor', async () => {
    const ctrl = new IntakeController({} as never, {} as never, {} as never, {} as never, {} as never);
    const actor = await (
      ctrl as unknown as { actorContext: (req: { staffAuthVia?: string }) => Promise<unknown> }
    ).actorContext({ staffAuthVia: 'internal' });
    expect(actor).toBeNull();
  });
});

describe('IntakeController sales-kit org routes', () => {
  it('keeps class ViewGuard and drops WriteGuard on org upload/approve', () => {
    const classGuards = (Reflect.getMetadata(GUARDS_METADATA, IntakeController) ?? []) as unknown[];
    expect(classGuards).toContain(StaffIntakeViewGuard);
    expect(classGuards).not.toContain(StaffIntakeWriteGuard);

    const uploadGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      IntakeController.prototype.uploadSalesKitFile,
    ) ?? []) as unknown[];
    const approveGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      IntakeController.prototype.approveSalesKitFile,
    ) ?? []) as unknown[];
    expect(uploadGuards).not.toContain(StaffIntakeWriteGuard);
    expect(approveGuards).not.toContain(StaffIntakeWriteGuard);

    const turnGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      IntakeController.prototype.salesKit,
    ) ?? []) as unknown[];
    expect(turnGuards).toContain(StaffIntakeWriteGuard);
    expect(typeof IntakeController.prototype.downloadSalesKitSample).toBe('function');
  });
});
