import { Module, forwardRef } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffIntakeViewGuard, StaffIntakeWriteGuard } from './guards/staff-intake.guard';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { IntakePgRepository } from './intake-pg.repository';
import { IntakeSqliteRepository } from './intake-sqlite.repository';

@Module({
  imports: [StaffAuthModule, forwardRef(() => LeadsModule)],
  controllers: [IntakeController],
  providers: [
    IntakeService,
    IntakeSqliteRepository,
    IntakePgRepository,
    StaffIntakeViewGuard,
    StaffIntakeWriteGuard,
  ],
  exports: [IntakeService, IntakeSqliteRepository, IntakePgRepository],
})
export class IntakeModule {}
