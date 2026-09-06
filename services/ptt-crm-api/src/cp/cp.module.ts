import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CpAuditRepository } from './cp-audit.repository';
import { CpController } from './cp.controller';
import { StaffCpGuard } from './guards/staff-cp.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [CpController],
  providers: [StaffCpGuard, CpAuditRepository],
})
export class CpModule {}
