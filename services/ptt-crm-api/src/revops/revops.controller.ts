import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, Header } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { RequireRevopsAction, StaffRevopsGuard } from './guards/staff-revops.guard';
import { RevopsApprovalsService } from './revops-approvals.service';
import { RevopsCommissionService } from './revops-commission.service';
import { RevopsDashboardService } from './revops-dashboard.service';
import { RevopsRoutingService } from './revops-routing.service';
import { RevopsReportsService } from './revops-reports.service';
import { RevopsSettingsService } from './revops-settings.service';
import { RevopsSlaService } from './revops-sla.service';
import type {
  RevopsApprovalsDto,
  RevopsCommandCenterDto,
  RevopsCreateCommissionPlanBody,
  RevopsCreateCommissionTransactionBody,
  RevopsCreatePayoutBatchBody,
  RevopsCreateRoutingRuleBody,
  RevopsCreateSlaPolicyBody,
  RevopsUpdateSlaPolicyBody,
  RevopsCreateTerritoryBody,
  RevopsUpdateTerritoryBody,
  RevopsPipelineDto,
  RevopsReportsDto,
  RevopsReportsQuery,
  RevopsRoutingSimulateBody,
  RevopsSettingsDto,
} from './revops.types';
import { RevopsPipelineService } from './revops-pipeline.service';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/revops')
@UseGuards(StaffOrInternalKeyGuard, StaffRevopsGuard)
export class RevopsController {
  constructor(
    private readonly dashboard: RevopsDashboardService,
    private readonly pipeline: RevopsPipelineService,
    private readonly approvals: RevopsApprovalsService,
    private readonly commission: RevopsCommissionService,
    private readonly sla: RevopsSlaService,
    private readonly routing: RevopsRoutingService,
    private readonly reports: RevopsReportsService,
    private readonly settings: RevopsSettingsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async caps(req: AuthedReq): Promise<StaffSectionCap[]> {
    if (req.staffAuthVia === 'internal' || !req.staffUser) return [];
    return (await this.staffAuth.me(req.staffUser)).caps;
  }

  @Get('command-center')
  @RequireRevopsAction('view')
  async commandCenter(
    @Req() req: AuthedReq,
    @Query('period') period?: string,
    @Query('bu') bu?: string,
    @Query('scope') scope?: string,
  ): Promise<RevopsCommandCenterDto> {
    const staffId = req.staffUser ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0) : 0;
    const caps = await this.caps(req);
    return this.dashboard.get({ staffId, caps }, { period, bu, scope });
  }

  @Get('pipeline')
  @RequireRevopsAction('view')
  async pipelineView(
    @Req() req: AuthedReq,
    @Query('view') view?: string,
    @Query('scope') scope?: string,
  ): Promise<RevopsPipelineDto> {
    const staffId = req.staffUser ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0) : 0;
    const caps = await this.caps(req);
    return this.pipeline.get({ staffId, caps }, { view, scope });
  }

  @Get('approvals')
  @RequireRevopsAction('view')
  async approvalsQueue(): Promise<RevopsApprovalsDto> {
    return this.approvals.list();
  }

  @Get('commission/plans')
  @RequireRevopsAction('view')
  async commissionPlans() {
    return this.commission.listPlans();
  }

  @Get('commission/hub')
  @RequireRevopsAction('view')
  async commissionHub() {
    return this.commission.getHub();
  }

  @Post('commission/plans')
  @RequireRevopsAction('manage')
  async createCommissionPlan(@Req() req: AuthedReq, @Body() body: RevopsCreateCommissionPlanBody) {
    return this.commission.createPlan(await this.caps(req), body);
  }

  @Get('commission/transactions')
  @RequireRevopsAction('view')
  async commissionTransactions(@Query('limit') limit?: string) {
    return this.commission.listTransactions(Number(limit) || 100);
  }

  @Post('commission/transactions')
  @RequireRevopsAction('manage')
  async createCommissionTransaction(
    @Req() req: AuthedReq,
    @Body() body: RevopsCreateCommissionTransactionBody,
  ) {
    return this.commission.recordTransaction(await this.caps(req), body);
  }

  @Get('commission/payout-batches')
  @RequireRevopsAction('view')
  async payoutBatches() {
    return this.commission.listPayoutBatches();
  }

  @Post('commission/payout-batches')
  @RequireRevopsAction('manage')
  async createPayoutBatch(@Req() req: AuthedReq, @Body() body: RevopsCreatePayoutBatchBody) {
    return this.commission.createPayoutBatch(await this.caps(req), body);
  }

  @Post('commission/payout-batches/:id/lock')
  @RequireRevopsAction('manage')
  async lockPayoutBatch(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.commission.lockPayoutBatch(await this.caps(req), id);
  }

  @Get('sla')
  @RequireRevopsAction('view')
  async slaCenter() {
    return this.sla.getCenter();
  }

  @Post('sla/policies')
  @RequireRevopsAction('manage')
  async createSlaPolicy(@Req() req: AuthedReq, @Body() body: RevopsCreateSlaPolicyBody) {
    return this.sla.createPolicy(await this.caps(req), body);
  }

  @Patch('sla/policies/:id')
  @RequireRevopsAction('manage')
  async updateSlaPolicy(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: RevopsUpdateSlaPolicyBody,
  ) {
    return this.sla.updatePolicy(await this.caps(req), id, body);
  }

  @Delete('sla/policies/:id')
  @RequireRevopsAction('manage')
  async deleteSlaPolicy(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.sla.deletePolicy(await this.caps(req), id);
  }

  @Get('territory')
  @RequireRevopsAction('view')
  async territoryCenter() {
    return this.routing.getCenter();
  }

  @Post('territory')
  @RequireRevopsAction('manage')
  async createTerritory(@Req() req: AuthedReq, @Body() body: RevopsCreateTerritoryBody) {
    return this.routing.createTerritory(await this.caps(req), body);
  }

  @Patch('territory/:id')
  @RequireRevopsAction('manage')
  async updateTerritory(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: RevopsUpdateTerritoryBody,
  ) {
    return this.routing.updateTerritory(await this.caps(req), id, body);
  }

  @Delete('territory/:id')
  @RequireRevopsAction('manage')
  async deleteTerritory(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.routing.deleteTerritory(await this.caps(req), id);
  }

  @Post('routing/rules')
  @RequireRevopsAction('manage')
  async createRoutingRule(@Req() req: AuthedReq, @Body() body: RevopsCreateRoutingRuleBody) {
    return this.routing.createRule(await this.caps(req), body);
  }

  @Post('routing/rules/:id/publish')
  @RequireRevopsAction('manage')
  async publishRoutingRule(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.routing.publishRule(await this.caps(req), id);
  }

  @Post('routing/simulate')
  @RequireRevopsAction('view')
  async simulateRouting(@Body() body: RevopsRoutingSimulateBody) {
    return this.routing.simulate(body);
  }

  @Get('reports')
  @RequireRevopsAction('view')
  async reportsCenter(
    @Req() req: AuthedReq,
    @Query('period') period?: string,
    @Query('bu') bu?: string,
    @Query('territory') territory?: string,
    @Query('scope') scope?: string,
  ): Promise<RevopsReportsDto> {
    const staffId = req.staffUser ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0) : 0;
    const caps = await this.caps(req);
    return this.reports.get({ staffId, caps }, { period, bu, territory, scope });
  }

  @Get('reports/:slug/export')
  @RequireRevopsAction('view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportReport(
    @Req() req: AuthedReq,
    @Param('slug') slug: string,
    @Query('period') period?: string,
    @Query('bu') bu?: string,
    @Query('territory') territory?: string,
    @Query('scope') scope?: string,
  ): Promise<string> {
    const staffId = req.staffUser ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0) : 0;
    const caps = await this.caps(req);
    const out = await this.reports.exportCsv({ staffId, caps }, slug, { period, bu, territory, scope });
    return out.csv;
  }

  @Get('settings')
  @RequireRevopsAction('view')
  async settingsCenter(): Promise<RevopsSettingsDto> {
    return this.settings.getCenter();
  }
}
