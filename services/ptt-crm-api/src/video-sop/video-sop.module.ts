import { Module } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffVdProjectCreateGuard,
  StaffVdProjectViewGuard,
} from './guards/staff-vd-project.guard';
import { VdProjectController } from './project/vd-project.controller';
import { VdProjectHttpService } from './project/vd-project-http.service';
import { VdProjectRepository } from './project/vd-project.repository';
import { VdProjectService } from './project/vd-project.service';

@Module({
  imports: [StaffAuthModule, ContentMarketingModule],
  controllers: [VdProjectController],
  providers: [
    VdProjectRepository,
    VdProjectService,
    VdProjectHttpService,
    StaffVdProjectCreateGuard,
    StaffVdProjectViewGuard,
  ],
})
export class VideoSopModule {}
