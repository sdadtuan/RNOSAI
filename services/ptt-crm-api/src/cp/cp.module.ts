import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CpAssetsRepository, CpAssetsService } from './cp-assets.service';
import { CpAuditRepository } from './cp-audit.repository';
import { CpController } from './cp.controller';
import { CpOverviewService } from './cp-overview.service';
import { CpProjectsRepository, CpProjectsService } from './cp-projects.service';
import { StaffCpGuard } from './guards/staff-cp.guard';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [CpController],
  providers: [
    StaffCpGuard,
    CpAuditRepository,
    CpAssetsRepository,
    CpAssetsService,
    CpOverviewService,
    CpProjectsRepository,
    CpProjectsService,
  ],
})
export class CpModule {}
