import { Module } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffVdProjectCreateGuard,
  StaffVdProjectViewGuard,
} from './guards/staff-vd-project.guard';
import { VdAssetRepository } from './assets/vd-asset.repository';
import { VdJobController } from './jobs/vd-job.controller';
import { VdJobHttpService } from './jobs/vd-job-http.service';
import { VdJobRepository } from './jobs/vd-job.repository';
import { VdDispatcherService } from './orchestration/vd-dispatcher.service';
import { VdPollerService } from './orchestration/vd-poller.service';
import { VdProjectController } from './project/vd-project.controller';
import { VdProjectHttpService } from './project/vd-project-http.service';
import { VdProjectRepository } from './project/vd-project.repository';
import { VdProjectService } from './project/vd-project.service';

@Module({
  imports: [StaffAuthModule, ContentMarketingModule],
  controllers: [VdProjectController, VdJobController],
  providers: [
    VdProjectRepository,
    VdProjectService,
    VdProjectHttpService,
    VdJobRepository,
    VdAssetRepository,
    VdDispatcherService,
    VdPollerService,
    VdJobHttpService,
    StaffVdProjectCreateGuard,
    StaffVdProjectViewGuard,
  ],
})
export class VideoSopModule {}
