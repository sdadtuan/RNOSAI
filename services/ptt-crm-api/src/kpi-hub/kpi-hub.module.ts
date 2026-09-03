import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { KpiHubAlertsService } from './alerts/kpi-hub-alerts.service';
import { KpiHubDashboardService, KpiHubFactsService } from './dashboard/kpi-hub-dashboard.service';
import { KpiHubDictionaryRepository } from './dictionary/kpi-hub-dictionary.repository';
import { KpiHubDictionaryService } from './dictionary/kpi-hub-dictionary.service';
import {
  StaffKpiHubDictionaryManageGuard,
  StaffKpiHubDictionaryPublishGuard,
  StaffKpiHubDictionaryViewGuard,
  StaffKpiHubQualityManageGuard,
  StaffKpiHubQualityViewGuard,
  StaffKpiHubReportsManageGuard,
  StaffKpiHubReportsViewGuard,
  StaffKpiHubSettingsManageGuard,
  StaffKpiHubSettingsViewGuard,
  StaffKpiHubSourcesConfigureGuard,
  StaffKpiHubSourcesViewGuard,
  StaffKpiHubTargetsManageGuard,
  StaffKpiHubTargetsViewGuard,
  StaffKpiHubViewGuard,
} from './guards/staff-kpi-hub.guard';
import { KpiHubController } from './kpi-hub.controller';
import { KpiHubSourcesService } from './mapping/kpi-hub-sources.service';
import { KpiHubQualityService } from './quality/kpi-hub-quality.service';
import { KpiHubActivityService, KpiHubReportsService } from './reports/kpi-hub-reports.service';
import { KpiHubTargetsService } from './targets/kpi-hub-targets.service';
import { KpiHubWorkspaceRepository } from './workspace/kpi-hub-workspace.repository';
import { KpiHubWorkspaceService } from './workspace/kpi-hub-workspace.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [KpiHubController],
  providers: [
    KpiHubWorkspaceRepository,
    KpiHubWorkspaceService,
    KpiHubDictionaryRepository,
    KpiHubDictionaryService,
    KpiHubSourcesService,
    KpiHubTargetsService,
    KpiHubAlertsService,
    KpiHubDashboardService,
    KpiHubFactsService,
    KpiHubQualityService,
    KpiHubReportsService,
    KpiHubActivityService,
    StaffKpiHubViewGuard,
    StaffKpiHubDictionaryViewGuard,
    StaffKpiHubDictionaryManageGuard,
    StaffKpiHubDictionaryPublishGuard,
    StaffKpiHubTargetsViewGuard,
    StaffKpiHubTargetsManageGuard,
    StaffKpiHubSourcesViewGuard,
    StaffKpiHubSourcesConfigureGuard,
    StaffKpiHubQualityViewGuard,
    StaffKpiHubQualityManageGuard,
    StaffKpiHubReportsViewGuard,
    StaffKpiHubReportsManageGuard,
    StaffKpiHubSettingsViewGuard,
    StaffKpiHubSettingsManageGuard,
  ],
  exports: [KpiHubDictionaryService, KpiHubDashboardService],
})
export class KpiHubModule {}
