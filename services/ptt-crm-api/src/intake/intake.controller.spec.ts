import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IntakeController } from './intake.controller';
import { StaffIntakeViewGuard, StaffIntakeWriteGuard } from './guards/staff-intake.guard';

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
