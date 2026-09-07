import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
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
  CP_VIDEOS_QUERY,
  CpVideosRepository,
  CpVideosService,
} from './cp-videos.service';
import { StaffCpGuard } from './guards/staff-cp.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule],
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
    CpVideosRepository,
    { provide: CP_VIDEOS_QUERY, useExisting: CpVideosRepository },
    CpVideosService,
  ],
})
export class CpModule {}
