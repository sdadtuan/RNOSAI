import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AmAuditRepository } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { AmController } from './am.controller';
import { StaffAmGuard } from './guards/staff-am.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [AmController],
  providers: [StaffAmGuard, AmDashboardService, AmAuditRepository],
  exports: [StaffAmGuard, AmDashboardService, AmAuditRepository],
})
export class AmModule {}
