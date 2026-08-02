import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffKpiViewGuard,
  StaffKpiWriteGuard,
} from './guards/staff-kpi.guard';
import { StaffKpiProgressGuard } from './guards/staff-kpi-progress.guard';
import { KpiController } from './kpi.controller';
import { KpiPgRepository } from './kpi-pg.repository';
import { KpiSqliteRepository } from './kpi-sqlite.repository';
import { KpiService } from './kpi.service';
import { StaffKpiController } from './staff-kpi.controller';
import { StaffKpiProgressController } from './staff-kpi-progress.controller';

@Module({
  imports: [StaffAuthModule, LeadsModule],
  controllers: [KpiController, StaffKpiController, StaffKpiProgressController],
  providers: [
    KpiService,
    KpiSqliteRepository,
    KpiPgRepository,
    StaffKpiViewGuard,
    StaffKpiWriteGuard,
    StaffKpiProgressGuard,
  ],
  exports: [KpiService],
})
export class KpiModule {}
