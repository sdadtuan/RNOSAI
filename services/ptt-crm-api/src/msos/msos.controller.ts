import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireMsosAction, StaffMsosGuard } from './guards/staff-msos.guard';
import { MsosService } from './msos.service';
import type {
  CapacityBucketInput,
  CreateDiscrepancyInput,
  CreateEvidenceInput,
  CreateEvidencePackInput,
  CreateInventoryInput,
  CreateMakeGoodInput,
  CreateOutcomeLinkInput,
  CreateDraftInput,
  CreateIoInput,
  CreateMediaLineInput,
  CreatePackageInput,
  GoLiveInput,
  CreatePartnerInput,
  CreatePlacementInput,
  CreateRateCardInput,
  CreateRateVersionInput,
  PartnerConfirmIoInput,
  ReserveMakeGoodCapacityInput,
  ReservePackageInput,
  SafetyChangeInput,
  UpsertTrafficInput,
} from './msos.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/media-os')
@UseGuards(StaffOrInternalKeyGuard, StaffMsosGuard)
export class MsosController {
  constructor(
    private readonly msos: MsosService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('health')
  @RequireMsosAction('view')
  health() {
    this.msos.assertEnabled();
    return this.msos.getHealth();
  }

  @Get('partners')
  @RequireMsosAction('view')
  listPartners() {
    return this.msos.listPartners();
  }

  @Post('partners')
  @RequireMsosAction('write')
  async createPartner(@Req() req: StaffReq, @Body() body: CreatePartnerInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.createPartner({ ...body, staffId });
  }

  @Get('inventory')
  @RequireMsosAction('view')
  listInventory() {
    return this.msos.listInventories();
  }

  @Post('inventory')
  @RequireMsosAction('write')
  createInventory(@Body() body: CreateInventoryInput) {
    return this.msos.createInventory(body);
  }

  @Get('placements')
  @RequireMsosAction('view')
  listPlacements() {
    return this.msos.listPlacements();
  }

  @Post('placements')
  @RequireMsosAction('write')
  createPlacement(@Body() body: CreatePlacementInput) {
    return this.msos.createPlacement(body);
  }

  @Post('rate-cards')
  @RequireMsosAction('write')
  createRateCard(@Body() body: CreateRateCardInput) {
    return this.msos.createRateCard(body);
  }

  @Post('rate-cards/:id/versions')
  @RequireMsosAction('write')
  appendRateVersion(@Param('id') id: string, @Body() body: CreateRateVersionInput) {
    return this.msos.appendRateVersion(id, body);
  }

  @Post('rate-cards/:id/versions/:version/publish')
  @RequireMsosAction('publish')
  async publishRateVersion(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.publishRateVersion(id, version, staffId);
  }

  @Put('placements/:id/capacity')
  @RequireMsosAction('write')
  setPlacementCapacity(@Param('id') id: string, @Body() body: { buckets: CapacityBucketInput[] }) {
    return this.msos.setPlacementCapacity(id, body.buckets ?? []);
  }

  @Get('placements/:id/calendar')
  @RequireMsosAction('view')
  getPlacementCalendar(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.msos.getPlacementCalendar(id, from, to);
  }

  @Get('packages')
  @RequireMsosAction('view')
  listPackages() {
    return this.msos.listPackages();
  }

  @Get('packages/:id')
  @RequireMsosAction('view')
  getPackage(@Param('id') id: string) {
    return this.msos.getPackage(id);
  }

  @Post('packages')
  @RequireMsosAction('write')
  async createPackage(@Req() req: StaffReq, @Body() body: CreatePackageInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.createPackage({ ...body, staffId });
  }

  @Post('packages/:id/reserve')
  @RequireMsosAction('write')
  reservePackage(@Param('id') id: string, @Body() body: ReservePackageInput) {
    return this.msos.reservePackage(id, body);
  }

  @Post('packages/:id/io')
  @RequireMsosAction('write')
  async createIo(@Req() req: StaffReq, @Param('id') id: string, @Body() body: CreateIoInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.createIo(id, { ...body, staffId });
  }

  @Get('insertion-orders/:id')
  @RequireMsosAction('view')
  getIo(@Param('id') id: string) {
    return this.msos.getIo(id);
  }

  @Get('insertion-orders/:id/export')
  @RequireMsosAction('view')
  exportIo(@Param('id') id: string) {
    return this.msos.exportIo(id);
  }

  @Post('insertion-orders/:id/issue')
  @RequireMsosAction('publish')
  async issueIo(@Req() req: StaffReq, @Param('id') id: string) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.issueIo(id, staffId);
  }

  @Post('insertion-orders/:id/partner-confirm')
  @RequireMsosAction('publish')
  confirmPartnerIo(@Param('id') id: string, @Body() body: PartnerConfirmIoInput) {
    return this.msos.confirmPartnerIo(id, body);
  }

  @Post('insertion-orders/:id/safety-change')
  @RequireMsosAction('write')
  async changeIoSafety(@Req() req: StaffReq, @Param('id') id: string, @Body() body: SafetyChangeInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.changeIoSafety(id, { ...body, staffId });
  }

  @Get('media-lines')
  @RequireMsosAction('view')
  listMediaLines() {
    return this.msos.listMediaLines();
  }

  @Post('media-lines')
  @RequireMsosAction('write')
  createMediaLine(@Body() body: CreateMediaLineInput) {
    return this.msos.createMediaLine(body);
  }

  @Get('media-lines/:id/gates')
  @RequireMsosAction('view')
  getLiveGates(@Param('id') id: string) {
    return this.msos.getLiveGates(id);
  }

  @Post('media-lines/:id/live')
  @RequireMsosAction('publish')
  async goLive(@Req() req: StaffReq, @Param('id') id: string, @Body() body: GoLiveInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.goLive(id, body, staffId);
  }

  @Post('media-lines/:id/p03-override')
  @RequireMsosAction('publish')
  async setP03Override(@Req() req: StaffReq, @Param('id') id: string) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.setP03Override(id, staffId);
  }

  @Get('media-lines/:id/traffic')
  @RequireMsosAction('view')
  getTraffic(@Param('id') id: string) {
    return this.msos.getTraffic(id);
  }

  @Put('media-lines/:id/traffic')
  @RequireMsosAction('write')
  upsertTraffic(@Param('id') id: string, @Body() body: UpsertTrafficInput) {
    return this.msos.upsertTraffic(id, body);
  }

  @Post('media-lines/:id/traffic/submit')
  @RequireMsosAction('write')
  submitTraffic(@Param('id') id: string) {
    return this.msos.submitTraffic(id);
  }

  @Post('media-lines/:id/traffic/approve')
  @RequireMsosAction('publish')
  approveTraffic(@Param('id') id: string) {
    return this.msos.approveTraffic(id);
  }

  @Post('evidence')
  @RequireMsosAction('write')
  async createEvidence(@Req() req: StaffReq, @Body() body: CreateEvidenceInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.createEvidence({ ...body, staffId });
  }

  @Post('evidence-packs')
  @RequireMsosAction('write')
  createEvidencePack(@Body() body: CreateEvidencePackInput) {
    return this.msos.createEvidencePack(body);
  }

  @Post('evidence-packs/:id/items')
  @RequireMsosAction('write')
  addEvidencePackItem(@Param('id') id: string, @Body() body: { evidence_id: string }) {
    return this.msos.addEvidencePackItem(id, body.evidence_id);
  }

  @Post('evidence-packs/:id/official')
  @RequireMsosAction('publish')
  officialEvidencePack(@Param('id') id: string) {
    return this.msos.officialEvidencePack(id);
  }

  @Post('media-lines/:id/discrepancy')
  @RequireMsosAction('write')
  createDiscrepancy(@Param('id') id: string, @Body() body: CreateDiscrepancyInput) {
    return this.msos.createDiscrepancy(id, body);
  }

  @Post('discrepancy/:id/make-good')
  @RequireMsosAction('write')
  async createMakeGood(@Req() req: StaffReq, @Param('id') id: string, @Body() body: CreateMakeGoodInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.createMakeGood(id, { ...body, staffId });
  }

  @Post('make-goods/:id/reserve-capacity')
  @RequireMsosAction('write')
  reserveMakeGoodCapacity(@Param('id') id: string, @Body() body: ReserveMakeGoodCapacityInput) {
    return this.msos.reserveMakeGoodCapacity(id, body);
  }

  @Get('outcome-links')
  @RequireMsosAction('view')
  listOutcomeLinks() {
    return this.msos.listOutcomeLinks();
  }

  @Post('outcome-links')
  @RequireMsosAction('write')
  createOutcomeLink(@Body() body: CreateOutcomeLinkInput) {
    return this.msos.createOutcomeLink(body);
  }

  @Get('media-lines/:id/margin')
  @RequireMsosAction('view')
  getMargin(@Param('id') id: string) {
    return this.msos.getMargin(id);
  }

  @Post('media-lines/:id/margin/submit')
  @RequireMsosAction('write')
  async submitMargin(@Req() req: StaffReq, @Param('id') id: string) {
    const isAdmin = await this.hasMsosAdmin(req);
    return this.msos.submitMargin(id, { isAdmin });
  }

  @Post('media-lines/:id/finance-request')
  @RequireMsosAction('finance_request')
  async createFinanceRequest(@Req() req: StaffReq, @Param('id') id: string) {
    const staffId = await this.resolveStaffId(req);
    if (staffId == null) {
      throw new ForbiddenException({ error: 'staff_id_required' });
    }
    return this.msos.createFinanceRequest(id, staffId);
  }

  @Get('exceptions')
  @RequireMsosAction('view')
  listExceptions() {
    return this.msos.listExceptions();
  }

  @Get('policies')
  @RequireMsosAction('view')
  listPolicies() {
    return this.msos.listPolicies();
  }

  @Get('evidence-packs')
  @RequireMsosAction('view')
  listEvidencePacks() {
    return this.msos.listEvidencePacks();
  }

  @Get('discrepancy-cases')
  @RequireMsosAction('view')
  listDiscrepancyCases() {
    return this.msos.listDiscrepancyCases();
  }

  @Get('make-goods')
  @RequireMsosAction('view')
  listMakeGoods() {
    return this.msos.listMakeGoods();
  }

  @Get('insertion-orders')
  @RequireMsosAction('view')
  listInsertionOrders() {
    return this.msos.listInsertionOrders();
  }

  @Get('rate-cards')
  @RequireMsosAction('view')
  listRateCards() {
    return this.msos.listRateCards();
  }

  @Get('packages/:id/reservations')
  @RequireMsosAction('view')
  listPackageReservations(@Param('id') id: string) {
    return this.msos.listPackageReservations(id);
  }

  @Post('exceptions/rebuild')
  @RequireMsosAction('admin')
  rebuildExceptions() {
    return this.msos.rebuildExceptions();
  }

  @Get('partners/:id/scorecard')
  @RequireMsosAction('view')
  getScorecard(@Param('id') id: string) {
    return this.msos.getScorecard(id);
  }

  @Post('partners/:id/scorecard/recompute')
  @RequireMsosAction('admin')
  recomputeScorecard(@Param('id') id: string) {
    return this.msos.recomputeScorecard(id);
  }

  @Get('partners/:id/eligibility')
  @RequireMsosAction('view')
  getEligibility(@Param('id') id: string) {
    return this.msos.getEligibility(id);
  }

  @Post('partners/:id/eligibility/reseller')
  @RequireMsosAction('admin')
  setEligibilityReseller(@Param('id') id: string, @Body() body: { open: boolean }) {
    return this.msos.setEligibilityReseller(id, Boolean(body.open));
  }

  @Post('drafts')
  @RequireMsosAction('view')
  createDraft(@Body() body: CreateDraftInput) {
    return this.msos.createDraft(body);
  }

  private async hasMsosAdmin(req: StaffReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) return false;
    const me = await this.staffAuth.me(req.staffUser);
    return this.staffAuth.hasCap(me.caps, 'crm_media', 'admin');
  }

  private async resolveStaffId(req: StaffReq): Promise<number | null> {
    if (req.staffAuthVia === 'internal') return null;
    if (!req.staffUser) return null;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? null;
  }
}
