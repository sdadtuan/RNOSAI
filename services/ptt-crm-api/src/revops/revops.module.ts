import { Module } from '@nestjs/common';
import { KpiHubModule } from '../kpi-hub/kpi-hub.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffRevopsGuard } from './guards/staff-revops.guard';
import { RevopsActionsService } from './revops-actions.service';
import { RevopsDashboardService } from './revops-dashboard.service';
import { RevopsTeamPerformanceService } from './revops-team-performance.service';
import { RevopsController } from './revops.controller';

@Module({
  imports: [StaffAuthModule, KpiHubModule],
  controllers: [RevopsController],
  providers: [StaffRevopsGuard, RevopsDashboardService, RevopsActionsService, RevopsTeamPerformanceService],
  exports: [RevopsDashboardService],
})
export class RevopsModule {}
