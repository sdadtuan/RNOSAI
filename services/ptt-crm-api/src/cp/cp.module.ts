import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { CreativesModule } from '../creatives/creatives.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CpAssetsRepository, CpAssetsService } from './cp-assets.service';
import { CpAuditRepository } from './cp-audit.repository';
import { CpBrandRepository, CpBrandService } from './cp-brand.service';
import { CpController } from './cp.controller';
import {
  CP_LEDGER_QUERY,
  CpLedgerRepository,
  CpLedgerService,
} from './cp-ledger.service';
import { CpOverviewService } from './cp-overview.service';
import { CpProjectsRepository, CpProjectsService } from './cp-projects.service';
import { CpRenderWorker } from './cp-render.worker';
import {
  CP_RENDERS_QUERY,
  CpRendersRepository,
  CpRendersService,
} from './cp-renders.service';
import {
  CP_SETTINGS_QUERY,
  CpSettingsRepository,
  CpSettingsService,
} from './cp-settings.service';
import {
  CP_VIDEOS_QUERY,
  CpVideosRepository,
  CpVideosService,
} from './cp-videos.service';
import { CpApprovalsService } from './cp-approvals.service';
import { CpCommentsService } from './cp-comments.service';
import { CpPublishService } from './cp-publish.service';
import { CpQcService } from './cp-qc.service';
import { CpContentOsHandoffService } from './cp-content-os-handoff.service';
import {
  CP_TEMPLATES_QUERY,
  CpTemplatesRepository,
  CpTemplatesService,
} from './cp-templates.service';
import {
  CP_BATCHES_QUERY,
  CpBatchesRepository,
  CpBatchesService,
} from './cp-batches.service';
import {
  CP_COLLECTIONS_QUERY,
  CpCollectionsRepository,
  CpCollectionsService,
} from './cp-collections.service';
import {
  CP_REPORTS_QUERY,
  CpReportsRepository,
  CpReportsService,
} from './cp-reports.service';
import { StaffCpGuard } from './guards/staff-cp.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule, CreativesModule],
  controllers: [CpController],
  providers: [
    StaffCpGuard,
    CpAuditRepository,
    CpAssetsRepository,
    CpAssetsService,
    CpBrandRepository,
    CpBrandService,
    CpLedgerRepository,
    { provide: CP_LEDGER_QUERY, useExisting: CpLedgerRepository },
    CpLedgerService,
    CpOverviewService,
    CpProjectsRepository,
    CpProjectsService,
    CpRendersRepository,
    { provide: CP_RENDERS_QUERY, useExisting: CpRendersRepository },
    CpRendersService,
    CpRenderWorker,
    CpSettingsRepository,
    { provide: CP_SETTINGS_QUERY, useExisting: CpSettingsRepository },
    CpSettingsService,
    CpVideosRepository,
    { provide: CP_VIDEOS_QUERY, useExisting: CpVideosRepository },
    CpVideosService,
    CpQcService,
    CpCommentsService,
    CpApprovalsService,
    CpPublishService,
    CpContentOsHandoffService,
    CpTemplatesRepository,
    { provide: CP_TEMPLATES_QUERY, useExisting: CpTemplatesRepository },
    CpTemplatesService,
    CpBatchesRepository,
    { provide: CP_BATCHES_QUERY, useExisting: CpBatchesRepository },
    CpBatchesService,
    CpCollectionsRepository,
    { provide: CP_COLLECTIONS_QUERY, useExisting: CpCollectionsRepository },
    CpCollectionsService,
    CpReportsRepository,
    { provide: CP_REPORTS_QUERY, useExisting: CpReportsRepository },
    CpReportsService,
  ],
})
export class CpModule {}
