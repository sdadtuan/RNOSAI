import { Module } from '@nestjs/common';
import { CsdModule } from '../csd/csd.module';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrInboxController } from './iwr-inbox.controller';
import { IwrInboxService } from './iwr-inbox.service';
import { IwrItemsService } from './iwr-items.service';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import { IwrReportsController } from './iwr-reports.controller';
import { IwrReportsService } from './iwr-reports.service';
import { IwrSuggestService } from './iwr-suggest.service';
import { IwrTemplatesController } from './iwr-templates.controller';

@Module({
  imports: [ConfigModule, StaffAuthModule, CsdModule],
  controllers: [IwrInboxController, IwrReportsController, IwrTemplatesController],
  providers: [
    StaffIwrGuard,
    IwrOrgRepository,
    IwrReportsRepository,
    IwrReportsService,
    IwrInboxService,
    IwrItemsService,
    IwrSuggestService,
  ],
  exports: [IwrReportsService, IwrInboxService],
})
export class IwrModule {}
