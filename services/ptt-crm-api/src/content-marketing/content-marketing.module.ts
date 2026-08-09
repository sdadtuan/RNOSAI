import { Module, forwardRef } from '@nestjs/common';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { ContentBrandContextService } from './content-brand-context.service';
import { ContentIdeaService } from './content-idea.service';
import { ContentItemService } from './content-item.service';
import { ContentPlanSnapshotService } from './content-plan-snapshot.service';
import { ContentMarketingController } from './content-marketing.controller';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingGenerateGuard,
  StaffContentMarketingPublishGuard,
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from './guards/staff-content-marketing.guard';

@Module({
  imports: [StaffAuthModule, forwardRef(() => ServiceLifecycleModule)],
  controllers: [ContentMarketingController],
  providers: [
    ContentMarketingRepository,
    ContentMarketingService,
    ContentBrandContextService,
    ContentPlanSnapshotService,
    ContentIdeaService,
    ContentItemService,
    StaffContentMarketingViewGuard,
    StaffContentMarketingWriteGuard,
    StaffContentMarketingGenerateGuard,
    StaffContentMarketingApproveGuard,
    StaffContentMarketingPublishGuard,
  ],
  exports: [
    ContentMarketingService,
    ContentMarketingRepository,
    ContentPlanSnapshotService,
    ContentIdeaService,
    ContentItemService,
  ],
})
export class ContentMarketingModule {}
