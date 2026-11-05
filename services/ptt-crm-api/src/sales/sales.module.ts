import { Module } from '@nestjs/common';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffSalesFunnelViewGuard,
  StaffSalesMarketWriteGuard,
  StaffSalesPartnerWriteGuard,
  StaffSalesTrainingWriteGuard,
  StaffSalesViewGuard,
  StaffSalesWriteGuard,
} from './guards/staff-sales.guard';
import { SalesController } from './sales.controller';
import { SalesPgRepository } from './sales-pg.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [StaffAuthModule, CrmConfigModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    SalesPgRepository,
    StaffSalesViewGuard,
    StaffSalesFunnelViewGuard,
    StaffSalesWriteGuard,
    StaffSalesPartnerWriteGuard,
    StaffSalesTrainingWriteGuard,
    StaffSalesMarketWriteGuard,
  ],
  exports: [SalesService, SalesPgRepository],
})
export class SalesModule {}
