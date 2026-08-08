import { Module, forwardRef } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { StaffNotificationsModule } from '../staff-notifications/staff-notifications.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffMarketingAiPlannerApproveGuard,
  StaffMarketingAiPlannerExportGuard,
  StaffMarketingAiPlannerGenerateGuard,
  StaffMarketingAiPlannerViewGuard,
} from './guards/staff-marketing-ai-planner.guard';
import { MarketingAiVersionService } from './marketing-ai-version.service';
import { MarketingAiApprovalService } from './marketing-ai-approval.service';
import { MarketingAiBudgetService } from './marketing-ai-budget.service';
import { MarketingAiExportService } from './marketing-ai-export.service';
import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import { MarketingAiRagService } from './marketing-ai-rag.service';
import { MarketingAiPlannerController } from './marketing-ai-planner.controller';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';

@Module({
  imports: [StaffAuthModule, StaffNotificationsModule, forwardRef(() => ServiceLifecycleModule), AiIntelligenceModule],
  controllers: [MarketingAiPlannerController],
  providers: [
    MarketingAiPlannerRepository,
    MarketingAiOrchestratorService,
    MarketingAiRagService,
    MarketingAiBudgetService,
    MarketingAiApprovalService,
    MarketingAiVersionService,
    MarketingAiExportService,
    MarketingAiPlannerService,
    StaffMarketingAiPlannerViewGuard,
    StaffMarketingAiPlannerGenerateGuard,
    StaffMarketingAiPlannerExportGuard,
    StaffMarketingAiPlannerApproveGuard,
  ],
  exports: [MarketingAiPlannerService, MarketingAiPlannerRepository],
})
export class MarketingAiPlannerModule {}
