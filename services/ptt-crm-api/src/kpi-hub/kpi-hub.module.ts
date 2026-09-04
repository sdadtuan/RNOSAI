import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { KpiHubAlertsService } from './alerts/kpi-hub-alerts.service';
import { KpiHubAlertEngineService } from './alerts/kpi-hub-alert-engine.service';
import { KpiHubBiController } from './bi/kpi-hub-bi.controller';
import { KpiHubConnectorRegistry } from './connectors/kpi-hub-connector.registry';
import { KpiHubDashboardService } from './dashboard/kpi-hub-dashboard.service';
import { KpiHubDictionaryRepository } from './dictionary/kpi-hub-dictionary.repository';
import { KpiHubDictionaryService } from './dictionary/kpi-hub-dictionary.service';
import { KpiHubExportService } from './export/kpi-hub-export.service';
import { KpiHubFactsRepository } from './facts/kpi-hub-facts.repository';
import { KpiHubFactsScheduler } from './facts/kpi-hub-facts.scheduler';
import { KpiHubFactsService } from './facts/kpi-hub-facts.service';
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
import { KpiHubNotificationsRepository } from './notifications/kpi-hub-notifications.repository';
import { KpiHubNotificationsService } from './notifications/kpi-hub-notifications.service';
import { KpiHubQualityRunnerService } from './quality/kpi-hub-quality-runner.service';
import { KpiHubQualityService } from './quality/kpi-hub-quality.service';
import { KpiHubActivityService, KpiHubReportsService } from './reports/kpi-hub-reports.service';
import { KpiHubTargetsService } from './targets/kpi-hub-targets.service';
import { KpiHubWorkspaceRepository } from './workspace/kpi-hub-workspace.repository';
import { KpiHubWorkspaceService } from './workspace/kpi-hub-workspace.service';

@Module({
  imports: [StaffAuthModule, ScheduleModule.forRoot()],
  controllers: [KpiHubController, KpiHubBiController],
  providers: [
    KpiHubWorkspaceRepository,
    KpiHubWorkspaceService,
    KpiHubDictionaryRepository,
    KpiHubDictionaryService,
    KpiHubConnectorRegistry,
    KpiHubSourcesService,
    KpiHubTargetsService,
    KpiHubAlertsService,
    KpiHubAlertEngineService,
    KpiHubNotificationsRepository,
    KpiHubNotificationsService,
    KpiHubFactsRepository,
    KpiHubFactsService,
    KpiHubFactsScheduler,
    KpiHubDashboardService,
    KpiHubExportService,
    KpiHubQualityRunnerService,
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
  exports: [KpiHubDictionaryService, KpiHubDashboardService, KpiHubAlertEngineService, KpiHubFactsService],
})
export class KpiHubModule {}
