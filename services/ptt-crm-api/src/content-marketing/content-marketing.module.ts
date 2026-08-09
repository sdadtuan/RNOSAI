import { Module, forwardRef } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { ContentAuditService } from './content-audit.service';
import { ContentBrandContextService } from './content-brand-context.service';
import { ContentCalendarService } from './content-calendar.service';
import { ContentCommentsService } from './content-comments.service';
import { ContentEmailBridgeService } from './content-email-bridge.service';
import { ContentGenerateService } from './content-generate.service';
import { ContentIdeaService } from './content-idea.service';
import { ContentIntelligenceService } from './content-intelligence.service';
import { ContentMetricsService } from './content-metrics.service';
import { ContentItemService } from './content-item.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentPlanSnapshotService } from './content-plan-snapshot.service';
import { ContentProductionService } from './content-production.service';
import { ContentMediaGenerateService } from './content-media-generate.service';
import { ContentMediaImageProvider } from './content-media-image.provider';
import { ContentMediaStorageService } from './content-media-storage.service';
import { ReplicateMediaProvider } from './content-media-replicate.provider';
import { StubMediaProvider } from './content-media-stub.provider';
import { ContentVisualQaService } from './content-visual-qa.service';
import { ContentRepurposeService } from './content-repurpose.service';
import { ContentSeoBridgeService } from './content-seo-bridge.service';
import { ContentVisualService } from './content-visual.service';
import { ContentWorkflowService } from './content-workflow.service';
import { ContentMarketingController } from './content-marketing.controller';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import { EmailMarketingModule } from '../email-marketing/email-marketing.module';
import { SeoContentModule } from '../seo-content/seo-content.module';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingAssignGuard,
  StaffContentMarketingGenerateGuard,
  StaffContentMarketingProductionGuard,
  StaffContentMarketingPublishGuard,
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from './guards/staff-content-marketing.guard';

@Module({
  imports: [
    StaffAuthModule,
    AiIntelligenceModule,
    SeoContentModule,
    EmailMarketingModule,
    forwardRef(() => ServiceLifecycleModule),
  ],
  controllers: [ContentMarketingController],
  providers: [
    ContentMarketingRepository,
    ContentMarketingService,
    ContentBrandContextService,
    ContentPlanSnapshotService,
    ContentWorkflowService,
    ContentCalendarService,
    ContentAuditService,
    ContentCommentsService,
    ContentMetricsService,
    ContentIntelligenceService,
    ContentRepurposeService,
    ContentSeoBridgeService,
    ContentEmailBridgeService,
    ContentProductionService,
    StubMediaProvider,
    ReplicateMediaProvider,
    ContentMediaStorageService,
    ContentVisualQaService,
    ContentMediaImageProvider,
    ContentMediaGenerateService,
    ContentVisualService,
    ContentGenerateService,
    ContentJobWorkerService,
    ContentIdeaService,
    ContentItemService,
    StaffContentMarketingViewGuard,
    StaffContentMarketingWriteGuard,
    StaffContentMarketingGenerateGuard,
    StaffContentMarketingApproveGuard,
    StaffContentMarketingAssignGuard,
    StaffContentMarketingPublishGuard,
    StaffContentMarketingProductionGuard,
  ],
  exports: [
    ContentMarketingService,
    ContentMarketingRepository,
    ContentPlanSnapshotService,
    ContentGenerateService,
    ContentIdeaService,
    ContentItemService,
  ],
})
export class ContentMarketingModule {}
