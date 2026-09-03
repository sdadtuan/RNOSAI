import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { KpiTypeConnectorRegistry } from './connectors/kpi-type-connector.registry';
import {
  StaffKpiTypesConfigureGuard,
  StaffKpiTypesManageGuard,
  StaffKpiTypesViewGuard,
} from './guards/staff-kpi-types.guard';
import { KpiTypeAuditRepository } from './kpi-type-audit.repository';
import { KpiTypesController } from './kpi-types.controller';
import { KpiTypesRepository } from './kpi-types.repository';
import { KpiTypesService } from './kpi-types.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [KpiTypesController],
  providers: [
    KpiTypesService,
    KpiTypesRepository,
    KpiTypeAuditRepository,
    KpiTypeConnectorRegistry,
    StaffKpiTypesViewGuard,
    StaffKpiTypesManageGuard,
    StaffKpiTypesConfigureGuard,
  ],
  exports: [KpiTypesService],
})
export class KpiTypesModule {}
