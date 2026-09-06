import { Module } from '@nestjs/common';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { AdminGovernanceModule } from '../admin-governance/admin-governance.module';
import { KpiHubModule } from '../kpi-hub/kpi-hub.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffRevopsGuard } from './guards/staff-revops.guard';
import { RevopsActionsService } from './revops-actions.service';
import { RevopsApprovalsService } from './revops-approvals.service';
import { RevopsCommissionService } from './revops-commission.service';
import { RevopsDashboardService } from './revops-dashboard.service';
import { RevopsPipelineRepository } from './revops-pipeline.repository';
import { RevopsPipelineService } from './revops-pipeline.service';
import { RevopsReportsService } from './revops-reports.service';
import { RevopsRoutingService } from './revops-routing.service';
import { RevopsSettingsService } from './revops-settings.service';
import { RevopsSlaService } from './revops-sla.service';
import { RevopsSlaWorker } from './revops-sla.worker';
import { RevopsTeamPerformanceService } from './revops-team-performance.service';
import { RevopsW3Repository } from './revops-w3.repository';
import { RevopsController } from './revops.controller';

@Module({
  imports: [StaffAuthModule, KpiHubModule, AdminAuditModule, AdminGovernanceModule],
  controllers: [RevopsController],
  providers: [
    StaffRevopsGuard,
    RevopsW3Repository,
    RevopsDashboardService,
    RevopsPipelineService,
    RevopsPipelineRepository,
    RevopsApprovalsService,
    RevopsActionsService,
    RevopsTeamPerformanceService,
    RevopsCommissionService,
    RevopsSlaService,
    RevopsSlaWorker,
    RevopsRoutingService,
    RevopsReportsService,
    RevopsSettingsService,
  ],
  exports: [RevopsDashboardService, RevopsPipelineService, RevopsApprovalsService, RevopsCommissionService],
})
export class RevopsModule {}
