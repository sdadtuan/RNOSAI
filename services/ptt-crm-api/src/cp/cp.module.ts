import { Module } from '@nestjs/common';
import { CampaignWritesModule } from '../campaign-writes/campaign-writes.module';
import { ConfigModule } from '../config/config.module';
import { CreativesModule } from '../creatives/creatives.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CpAssetsRepository, CpAssetsService } from './cp-assets.service';
import { CpAuditRepository } from './cp-audit.repository';
import { CpBrandRepository, CpBrandService } from './cp-brand.service';
import { CpController } from './cp.controller';
import { CpMagnificOAuthCallbackController } from './cp-magnific-oauth.controller';
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
import { CP_PLAYBOOKS_QUERY, CpPlaybooksService } from './cp-playbooks.service';
import { CP_RE_HANDOFF_QUERY, CpReHandoffService } from './cp-re-handoff.service';
import { CpQcService } from './cp-qc.service';
import { CpSopIngestService } from './cp-sop-ingest.service';
import { CpContentOsHandoffService } from './cp-content-os-handoff.service';
import { CpLaunchGateService } from './cp-launch-gate.service';
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
import {
  CP_EXPERIMENTS_QUERY,
  CpExperimentsRepository,
  CpExperimentsService,
} from './cp-experiments.service';
import { StaffCpGuard } from './guards/staff-cp.guard';
import { CpWeaveIngestController } from './cp-weave-ingest.controller';
import { CpWeaveIngestWorker } from './cp-weave-ingest.worker';
import { CP_WEAVE_QUERY, CpWeaveRepository } from './cp-weave.repository';
import { CpWeaveService } from './cp-weave.service';
import {
  CP_CONNECTIONS_QUERY,
  CpProviderConnectionsRepository,
  CpProviderConnectionsService,
} from './cp-provider-connections.service';
import { CP_JOBS_QUERY, CpJobsRepository } from './cp-jobs.repository';
import { CpMagnificMcpAdapter } from './cp-magnific-mcp.adapter';
import { CpMagnificRestAdapter } from './cp-magnific-rest.adapter';
import { MagnificAdapters } from './cp-magnific.adapters';
import { MAGNIFIC_ADAPTER, CpJobsService } from './cp-jobs.service';
import { CpComfyAdapter } from './cp-comfy.adapter';

@Module({
  imports: [ConfigModule, StaffAuthModule, CreativesModule, CampaignWritesModule],
  controllers: [CpController, CpWeaveIngestController, CpMagnificOAuthCallbackController],
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
    CpSopIngestService,
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
    CpExperimentsRepository,
    { provide: CP_EXPERIMENTS_QUERY, useExisting: CpExperimentsRepository },
    CpExperimentsService,
    { provide: CP_PLAYBOOKS_QUERY, useExisting: CpBatchesRepository },
    CpPlaybooksService,
    { provide: CP_RE_HANDOFF_QUERY, useExisting: CpProjectsRepository },
    CpReHandoffService,
    CpLaunchGateService,
    CpWeaveRepository,
    { provide: CP_WEAVE_QUERY, useExisting: CpWeaveRepository },
    CpWeaveService,
    CpWeaveIngestWorker,
    CpProviderConnectionsRepository,
    { provide: CP_CONNECTIONS_QUERY, useExisting: CpProviderConnectionsRepository },
    CpProviderConnectionsService,
    { provide: CP_JOBS_QUERY, useExisting: CpRendersRepository },
    CpJobsRepository,
    {
      provide: CpMagnificMcpAdapter,
      useFactory: (connections: CpProviderConnectionsService) =>
        new CpMagnificMcpAdapter({
          getToken: () => connections.loadDecryptedSecret('magnific_mcp'),
          waitTimeoutMs: magnificVideoWaitMs(),
        }),
      inject: [CpProviderConnectionsService],
    },
    {
      provide: CpMagnificRestAdapter,
      useFactory: (connections: CpProviderConnectionsService) =>
        new CpMagnificRestAdapter({
          getApiKey: () => connections.loadDecryptedSecret('magnific_rest'),
          waitTimeoutMs: magnificVideoWaitMs(),
        }),
      inject: [CpProviderConnectionsService],
    },
    MagnificAdapters,
    { provide: MAGNIFIC_ADAPTER, useExisting: MagnificAdapters },
    CpComfyAdapter,
    CpJobsService,
  ],
  exports: [CpProjectsService, CpLaunchGateService],
})
export class CpModule {}

function magnificVideoWaitMs(): number {
  const sec = Number(process.env.MAGNIFIC_VIDEO_WAIT_SEC ?? 600);
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 600_000;
}
