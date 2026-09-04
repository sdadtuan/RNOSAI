import { Module, forwardRef } from '@nestjs/common';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { KpiHubModule } from '../kpi-hub/kpi-hub.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { DeliveryBudgetRepository } from './delivery-budget.repository';
import { DeliveryProjectKpisRepository } from './delivery-project-kpis.repository';
import { DeliveryOpsRepository } from './delivery-ops.repository';
import { DeliveryOpsService } from './delivery-ops.service';
import { DeliveryProjectsController } from './delivery-projects.controller';
import { DeliveryProjectsRepository } from './delivery-projects.repository';
import { DeliveryProjectsService } from './delivery-projects.service';
import {
  StaffDeliveryBudgetApproveGuard,
  StaffDeliveryBudgetEditGuard,
  StaffDeliveryBudgetViewGuard,
} from './guards/staff-delivery-budget.guard';
import {
  StaffDeliveryProjectsEditGuard,
  StaffDeliveryProjectsManageGuard,
  StaffDeliveryProjectsViewGuard,
} from './guards/staff-delivery-projects.guard';

@Module({
  imports: [StaffAuthModule, B2bProjectsModule, forwardRef(() => KpiHubModule)],
  controllers: [DeliveryProjectsController],
  providers: [
    DeliveryProjectsRepository,
    DeliveryBudgetRepository,
    DeliveryProjectKpisRepository,
    DeliveryProjectsService,
    DeliveryOpsRepository,
    DeliveryOpsService,
    StaffDeliveryProjectsViewGuard,
    StaffDeliveryProjectsEditGuard,
    StaffDeliveryProjectsManageGuard,
    StaffDeliveryBudgetViewGuard,
    StaffDeliveryBudgetEditGuard,
    StaffDeliveryBudgetApproveGuard,
  ],
  exports: [
    DeliveryProjectsService,
    DeliveryProjectsRepository,
    DeliveryOpsService,
    DeliveryOpsRepository,
  ],
})
export class DeliveryProjectsModule {}
