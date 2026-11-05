import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { KpiHubAlertsService } from './alerts/kpi-hub-alerts.service';
import { KpiHubApprovalsService } from './approvals/kpi-hub-approvals.service';
import { KpiHubDashboardService } from './dashboard/kpi-hub-dashboard.service';
import { KpiHubLineageService } from './lineage/kpi-hub-lineage.service';
import { KpiHubExportService } from './export/kpi-hub-export.service';
import { KpiHubFactsService } from './facts/kpi-hub-facts.service';
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
import { KpiHubSourcesService } from './mapping/kpi-hub-sources.service';
import { KpiHubQualityService } from './quality/kpi-hub-quality.service';
import { KpiHubActivityService, KpiHubReportsService } from './reports/kpi-hub-reports.service';
import { KpiHubNotificationsService } from './notifications/kpi-hub-notifications.service';
import { KpiHubTargetsService } from './targets/kpi-hub-targets.service';
import { KpiHubWorkspaceService } from './workspace/kpi-hub-workspace.service';
import type {
  AssignQualityIssueBody,
  CreateHubDictionaryBody,
  CreateHubReportBody,
  CreateQualityTicketBody,
  DuplicateHubDictionaryBody,
  HubAlertListQuery,
  HubDashboardQuery,
  HubDictionaryListQuery,
  HubNotificationListQuery,
  HubReportListQuery,
  HubTargetListQuery,
  PatchHubDictionaryBody,
  PatchHubTargetBody,
  PatchHubWorkspaceBody,
  PreviewHubDictionaryBody,
  ScheduleHubReportBody,
  ShareHubReportBody,
  UpsertHubTargetBody,
  ValidateHubDictionaryBody,
} from './kpi-hub.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/kpi-hub')
@UseGuards(StaffOrInternalKeyGuard)
export class KpiHubController {
  constructor(
    private readonly workspace: KpiHubWorkspaceService,
    private readonly dictionary: KpiHubDictionaryService,
    private readonly sources: KpiHubSourcesService,
    private readonly targets: KpiHubTargetsService,
    private readonly alerts: KpiHubAlertsService,
    private readonly dashboard: KpiHubDashboardService,
    private readonly facts: KpiHubFactsService,
    private readonly exportSvc: KpiHubExportService,
    private readonly quality: KpiHubQualityService,
    private readonly reports: KpiHubReportsService,
    private readonly activity: KpiHubActivityService,
    private readonly notifications: KpiHubNotificationsService,
    private readonly approvals: KpiHubApprovalsService,
    private readonly lineage: KpiHubLineageService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private parseRowVersion(header: string | undefined): number {
    const raw = String(header ?? '').trim();
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return 0;
    return n;
  }

  private async actor(req: AuthedReq) {
    if (req.staffAuthVia === 'internal') {
      return { staffId: 1, canConfigure: true, canPublish: true };
    }
    if (!req.staffUser) return { staffId: 0, canConfigure: false, canPublish: false };
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    return {
      staffId,
      canConfigure: this.staffAuth.hasCap(me.caps, 'crm_kpi_dictionary', 'manage'),
      canPublish: this.staffAuth.hasCap(me.caps, 'crm_kpi_dictionary', 'publish'),
    };
  }

  @Get('workspace')
  @UseGuards(StaffKpiHubSettingsViewGuard)
  getWorkspace() {
    return this.workspace.get();
  }

  @Patch('workspace')
  @UseGuards(StaffKpiHubSettingsManageGuard)
  patchWorkspace(@Body() body: PatchHubWorkspaceBody, @Headers('if-match') ifMatch?: string) {
    return this.workspace.patch(body, this.parseRowVersion(ifMatch));
  }

  @Get('dashboard')
  @UseGuards(StaffKpiHubViewGuard)
  getDashboard(@Query() query: HubDashboardQuery) {
    return this.dashboard.getDashboard(query);
  }

  @Get('dashboard/drilldown/:code')
  @UseGuards(StaffKpiHubViewGuard)
  getDrilldown(@Param('code') code: string, @Query() query: HubDashboardQuery) {
    return this.dashboard.getDrilldown(code, query);
  }

  @Post('facts/recompute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffKpiHubSettingsManageGuard)
  recomputeFacts(@Body() body: { period?: string }) {
    const now = new Date();
    const period = body?.period ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.facts.computePeriod(period);
  }

  @Get('export/dictionary.xlsx')
  @UseGuards(StaffKpiHubDictionaryViewGuard)
  async exportDictionary(@Res() res: Response) {
    const buf = await this.exportSvc.exportDictionaryXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="kpi-hub-dictionary.xlsx"');
    res.send(buf);
  }

  @Get('export/targets.xlsx')
  @UseGuards(StaffKpiHubTargetsViewGuard)
  async exportTargets(@Res() res: Response) {
    const buf = await this.exportSvc.exportTargetsXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="kpi-hub-targets.xlsx"');
    res.send(buf);
  }

  @Post('targets/import/preview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffKpiHubTargetsManageGuard)
  previewTargetImport(@Body() body: { rows?: Array<Record<string, unknown>> }) {
    return this.exportSvc.previewTargetImport(body.rows ?? []);
  }

  @Get('dictionary')
  @UseGuards(StaffKpiHubDictionaryViewGuard)
  listDictionary(@Query() query: HubDictionaryListQuery) {
    return this.dictionary.list(query);
  }

  @Get('dictionary/summary')
  @UseGuards(StaffKpiHubDictionaryViewGuard)
  dictionarySummary() {
    return this.dictionary.summary();
  }

  @Post('dictionary')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  async createDictionary(@Req() req: AuthedReq, @Body() body: CreateHubDictionaryBody) {
    return this.dictionary.create(await this.actor(req), body);
  }

  @Get('dictionary/:id')
  @UseGuards(StaffKpiHubDictionaryViewGuard)
  getDictionary(@Param('id') id: string) {
    return this.dictionary.getById(id);
  }

  @Patch('dictionary/:id')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  async patchDictionary(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: PatchHubDictionaryBody,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.dictionary.update(await this.actor(req), id, body, this.parseRowVersion(ifMatch));
  }

  @Post('dictionary/:id/publish')
  @UseGuards(StaffKpiHubDictionaryPublishGuard)
  async publishDictionary(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.dictionary.publish(await this.actor(req), id, this.parseRowVersion(ifMatch));
  }

  @Post('dictionary/:id/validate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  validateDictionary(@Param('id') id: string, @Body() body: ValidateHubDictionaryBody) {
    return this.dictionary.validate(id, body);
  }

  @Get('dictionary/:id/dependencies')
  @UseGuards(StaffKpiHubDictionaryViewGuard)
  dictionaryDependencies(@Param('id') id: string) {
    return this.dictionary.getDependencies(id);
  }

  @Post('dictionary/:id/preview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  previewDictionary(@Param('id') id: string, @Body() body: PreviewHubDictionaryBody) {
    return this.dictionary.preview(id, body);
  }

  @Post('dictionary/:id/duplicate')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  async duplicateDictionary(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: DuplicateHubDictionaryBody,
  ) {
    return this.dictionary.duplicate(await this.actor(req), id, body);
  }

  @Get('sources')
  @UseGuards(StaffKpiHubSourcesViewGuard)
  listSources() {
    return this.sources.list();
  }

  @Post('sources/:id/refresh')
  @UseGuards(StaffKpiHubSourcesConfigureGuard)
  refreshSource(@Param('id') id: string) {
    return this.sources.refresh(id);
  }

  @Get('targets')
  @UseGuards(StaffKpiHubTargetsViewGuard)
  listTargets(@Query() query: HubTargetListQuery) {
    return this.targets.list(query);
  }

  @Post('targets')
  @UseGuards(StaffKpiHubTargetsManageGuard)
  upsertTarget(@Body() body: UpsertHubTargetBody) {
    return this.targets.upsert(body);
  }

  @Patch('targets/:id')
  @UseGuards(StaffKpiHubTargetsManageGuard)
  patchTarget(
    @Param('id') id: string,
    @Body() body: PatchHubTargetBody,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.targets.patch(id, body, this.parseRowVersion(ifMatch));
  }

  @Get('targets/:id/history')
  @UseGuards(StaffKpiHubTargetsViewGuard)
  targetHistory(@Param('id') id: string) {
    return this.targets.history(id);
  }

  @Get('alerts')
  @UseGuards(StaffKpiHubViewGuard)
  listAlerts(@Query() query: HubAlertListQuery) {
    return this.alerts.list(query);
  }

  @Post('alerts/:id/ack')
  @UseGuards(StaffKpiHubTargetsManageGuard)
  async ackAlert(@Req() req: AuthedReq, @Param('id') id: string) {
    const { staffId } = await this.actor(req);
    return this.alerts.ack(id, staffId);
  }

  @Get('notifications')
  @UseGuards(StaffKpiHubViewGuard)
  async listNotifications(@Req() req: AuthedReq, @Query() query: HubNotificationListQuery) {
    const { staffId } = await this.actor(req);
    return this.notifications.list(staffId || 101, query);
  }

  @Patch('notifications/:id/read')
  @UseGuards(StaffKpiHubViewGuard)
  async readNotification(@Req() req: AuthedReq, @Param('id') id: string) {
    const { staffId } = await this.actor(req);
    return this.notifications.markRead(id, staffId || 101);
  }

  @Get('quality')
  @UseGuards(StaffKpiHubQualityViewGuard)
  getQuality() {
    return this.quality.getOverview();
  }

  @Post('quality/run')
  @UseGuards(StaffKpiHubQualityManageGuard)
  async runQuality(@Req() req: AuthedReq) {
    const { staffId } = await this.actor(req);
    return this.quality.runCheck(staffId);
  }

  @Get('quality/issues/:id')
  @UseGuards(StaffKpiHubQualityViewGuard)
  getQualityIssue(@Param('id') id: string) {
    return this.quality.getIssue(id);
  }

  @Post('quality/issues/:id/assign')
  @UseGuards(StaffKpiHubQualityManageGuard)
  assignQualityIssue(@Param('id') id: string, @Body() body: AssignQualityIssueBody) {
    return this.quality.assign(id, body);
  }

  @Post('quality/issues/:id/ticket')
  @UseGuards(StaffKpiHubQualityManageGuard)
  createQualityTicket(@Param('id') id: string, @Body() body: CreateQualityTicketBody) {
    return this.quality.createTicket(id, body);
  }

  @Get('reports')
  @UseGuards(StaffKpiHubReportsViewGuard)
  listReports(@Query() query: HubReportListQuery) {
    return this.reports.list(query);
  }

  @Post('reports')
  @UseGuards(StaffKpiHubReportsManageGuard)
  async createReport(@Req() req: AuthedReq, @Body() body: CreateHubReportBody) {
    const { staffId } = await this.actor(req);
    return this.reports.create(body, staffId);
  }

  @Post('reports/:id/share')
  @UseGuards(StaffKpiHubReportsManageGuard)
  shareReport(@Param('id') id: string, @Body() body: ShareHubReportBody) {
    return this.reports.share(id, body);
  }

  @Post('reports/:id/schedule')
  @UseGuards(StaffKpiHubReportsManageGuard)
  scheduleReport(@Param('id') id: string, @Body() body: ScheduleHubReportBody) {
    return this.reports.schedule(id, body);
  }

  @Post('reports/:id/send')
  @UseGuards(StaffKpiHubReportsManageGuard)
  sendReport(@Param('id') id: string) {
    return this.reports.send(id);
  }

  @Get('activity')
  @UseGuards(StaffKpiHubSettingsViewGuard)
  listActivity() {
    return this.activity.list();
  }

  @Get('approvals')
  @UseGuards(StaffKpiHubViewGuard)
  listApprovals() {
    return this.approvals.list();
  }

  @Post('approvals/:kind/:id/approve')
  @UseGuards(StaffKpiHubSettingsManageGuard)
  approveItem(@Param('kind') kind: string, @Param('id') id: string, @Body() body: { note?: string }) {
    return this.approvals.approve(kind, id, body?.note ?? null);
  }

  @Post('approvals/:kind/:id/reject')
  @UseGuards(StaffKpiHubSettingsManageGuard)
  rejectItem(@Param('kind') kind: string, @Param('id') id: string, @Body() body: { note?: string }) {
    return this.approvals.reject(kind, id, body?.note ?? null);
  }

  @Get('lineage')
  @UseGuards(StaffKpiHubViewGuard)
  getLineage(@Query('code') code?: string) {
    return this.lineage.getByCode(code ?? '');
  }
}
