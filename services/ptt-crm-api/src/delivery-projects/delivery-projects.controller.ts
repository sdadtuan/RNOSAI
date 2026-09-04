import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { DeliveryOpsService } from './delivery-ops.service';
import type {
  CreateDeliveryChangeRequestBody,
  CreateDeliveryRiskBody,
  PatchDeliveryRiskBody,
} from './delivery-ops.types';
import { DeliveryProjectsService } from './delivery-projects.service';
import type {
  AttachProjectKpisBody,
  BudgetItemBody,
  CreateDeliveryBody,
  PatchDeliveryBody,
  ResourceBody,
  SaveWizardBody,
  SubmitDeliveryBody,
} from './delivery-projects.types';
import {
  StaffDeliveryBudgetEditGuard,
  StaffDeliveryBudgetViewGuard,
} from './guards/staff-delivery-budget.guard';
import {
  StaffDeliveryProjectsEditGuard,
  StaffDeliveryProjectsManageGuard,
  StaffDeliveryProjectsViewGuard,
} from './guards/staff-delivery-projects.guard';

type ReqWithStaff = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/delivery-projects')
@UseGuards(StaffOrInternalKeyGuard)
export class DeliveryProjectsController {
  constructor(
    private readonly svc: DeliveryProjectsService,
    private readonly ops: DeliveryOpsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get()
  @UseGuards(StaffDeliveryProjectsViewGuard)
  list(@Query('capability') capability?: string, @Query('q') q?: string, @Query('status') status?: string) {
    return this.svc.list({ capability, q, status });
  }

  @Post()
  @UseGuards(StaffDeliveryProjectsEditGuard)
  async create(@Body() body: CreateDeliveryBody, @Req() req: ReqWithStaff) {
    const actorStaffId = await this.resolveStaffId(req);
    const canManageB2b = await this.canManageB2b(req);
    return this.svc.create(body, actorStaffId, canManageB2b);
  }

  @Get(':id')
  @UseGuards(StaffDeliveryProjectsViewGuard)
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Patch(':id')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  patch(@Param('id') id: string, @Body() body: PatchDeliveryBody) {
    return this.svc.patch(id, body);
  }

  @Post('backfill')
  @UseGuards(StaffDeliveryProjectsManageGuard)
  async backfill(@Req() req: ReqWithStaff) {
    const actorStaffId = await this.resolveStaffId(req);
    return this.svc.backfill(actorStaffId);
  }

  @Get('risks')
  @UseGuards(StaffDeliveryProjectsViewGuard)
  listAllRisks() {
    return this.ops.listRisks();
  }

  @Get('capacity')
  @UseGuards(StaffDeliveryProjectsViewGuard)
  getCapacity(@Query('weeks') weeks?: string) {
    const n = Math.min(12, Math.max(1, Number(weeks ?? 4) || 4));
    return this.ops.getCapacity(n);
  }

  @Get('quality')
  @UseGuards(StaffDeliveryProjectsViewGuard)
  listQuality(@Query('period') period?: string) {
    return this.ops.listQuality(period);
  }

  @Post('quality/compute')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  computeAllQuality(@Query('period') period?: string) {
    return this.ops.computeAllQuality(period);
  }

  @Put(':id/wizard')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  saveWizard(@Param('id') id: string, @Body() body: SaveWizardBody) {
    return this.svc.saveWizard(id, body);
  }

  @Post(':id/milestones/validate-deps')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  validateDeps(@Param('id') id: string, @Body() body: { deps: Array<{ from: string; to: string }> }) {
    void id;
    return this.svc.validateDeps(body.deps ?? []);
  }

  @Get(':id/budget-items')
  @UseGuards(StaffDeliveryBudgetViewGuard)
  listBudgetItems(@Param('id') id: string) {
    return this.svc.listBudgetItems(id);
  }

  @Post(':id/budget-items')
  @UseGuards(StaffDeliveryBudgetEditGuard)
  createBudgetItem(@Param('id') id: string, @Body() body: BudgetItemBody) {
    return this.svc.createBudgetItem(id, body);
  }

  @Post(':id/budget-items/preview-impact')
  @UseGuards(StaffDeliveryBudgetEditGuard)
  previewBudgetImpact(@Param('id') id: string, @Body() body: BudgetItemBody) {
    return this.svc.previewBudgetImpact(id, body);
  }

  @Get(':id/resources')
  @UseGuards(StaffDeliveryBudgetViewGuard)
  listResources(@Param('id') id: string) {
    return this.svc.listResources(id);
  }

  @Post(':id/resources')
  @UseGuards(StaffDeliveryBudgetEditGuard)
  createResource(@Param('id') id: string, @Body() body: ResourceBody) {
    return this.svc.createResource(id, body);
  }

  @Get(':id/kpis')
  @UseGuards(StaffDeliveryProjectsViewGuard)
  listKpis(@Param('id') id: string) {
    return this.svc.listKpis(id);
  }

  @Post(':id/kpis')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  attachKpis(@Param('id') id: string, @Body() body: AttachProjectKpisBody) {
    return this.svc.attachKpis(id, body);
  }

  @Post(':id/submit')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  async submit(@Param('id') id: string, @Body() body: SubmitDeliveryBody, @Req() req: ReqWithStaff) {
    const caps = await this.resolveCaps(req);
    return this.svc.submit(id, body, caps);
  }

  @Get(':id/risks')
  @UseGuards(StaffDeliveryProjectsViewGuard)
  listRisks(@Param('id') id: string) {
    return this.ops.listRisks(id);
  }

  @Post(':id/risks')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  createRisk(@Param('id') id: string, @Body() body: CreateDeliveryRiskBody) {
    return this.ops.createRisk(id, body);
  }

  @Patch(':id/risks/:riskId')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  patchRisk(@Param('id') id: string, @Param('riskId') riskId: string, @Body() body: PatchDeliveryRiskBody) {
    return this.ops.patchRisk(id, riskId, body);
  }

  @Get(':id/change-requests')
  @UseGuards(StaffDeliveryProjectsViewGuard)
  listChangeRequests(@Param('id') id: string, @Query('status') status?: string) {
    return this.ops.listChangeRequests(id, status);
  }

  @Post(':id/change-requests')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  async createChangeRequest(
    @Param('id') id: string,
    @Body() body: CreateDeliveryChangeRequestBody,
    @Req() req: ReqWithStaff,
  ) {
    const actorStaffId = await this.resolveStaffId(req);
    return this.ops.createChangeRequest(id, body, actorStaffId);
  }

  @Post(':id/quality/compute')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  computeQuality(@Param('id') id: string, @Query('period') period?: string) {
    return this.ops.computeQuality(id, period);
  }

  @Post(':id/schedule')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  scheduleReports(@Param('id') id: string, @Body() body: { cadence_json?: Record<string, unknown> }) {
    return this.ops.scheduleClientReports(id, body.cadence_json ?? {});
  }

  @Post(':id/milestones/:code/request-approval')
  @UseGuards(StaffDeliveryProjectsEditGuard)
  async requestMilestoneApproval(
    @Param('id') id: string,
    @Param('code') code: string,
    @Req() req: ReqWithStaff,
  ) {
    const actorStaffId = await this.resolveStaffId(req);
    return this.ops.requestMilestoneApproval(id, code, actorStaffId);
  }

  private async resolveCaps(req: ReqWithStaff): Promise<Record<string, string[]>> {
    if (req.staffAuthVia === 'internal') return { crm_delivery_budget: ['approve'] };
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    return me.caps;
  }

  private async resolveStaffId(req: ReqWithStaff): Promise<number> {
    if (req.staffAuthVia === 'internal') return 0;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    return me.staff_id;
  }

  private async canManageB2b(req: ReqWithStaff): Promise<boolean> {
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_b2b_projects', 'manage')) {
      return false;
    }
    return true;
  }
}
