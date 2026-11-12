import {
  Body,
  Controller,
  Get,
  ForbiddenException,
  HttpCode,
  HttpException,
  HttpStatus,
  StreamableFile,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { extractHttpErrorMessage } from '../common/http-error.util';
import { InternalKeyGuard } from '../auth/internal-key.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import {
  AdvancePresalesBody,
  CompleteCareStageBody,
  ConsultPrefillBody,
  EnsurePresalesBody,
  HandoffSolutionBody,
  ReturnSolutionBody,
  PatchMarketingPlanBody,
  PatchClientBriefBody,
  PatchPresalesL2DocsBody,
  PatchPresalesTaskBody,
  PresalesAiAssistBody,
  PresalesConsultSlaReminderBody,
  ReleaseReviewQueueBody,
  UpgradePresalesWorkflowBody,
  BatchUpgradePresalesWorkflowBody,
} from './leads-funnel.types';
import { LeadsFunnelEnabledGuard, PresalesOnLeadGuard } from './guards/leads-funnel-enabled.guard';
import { StaffLeadsGdkdGuard } from './guards/staff-leads-gdkd.guard';
import { LeadNotInReviewQueueGuard } from './guards/lead-not-in-review-queue.guard';
import {
  StaffPresalesSolutionClaimGuard,
  StaffPresalesSolutionQueueGuard,
  StaffPresalesSolutionReleaseGuard,
} from './guards/staff-presales-solution.guard';
import { StaffConsultAiGenerateGuard } from './guards/staff-consult-ai.guard';
import { isAccountManagerPosition, isMarketingLeaderPosition } from '../b2b-projects/b2b-director.util';
import { maskPartialPii } from '../staff-permissions/field-level.serializer';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { LeadsFunnelService } from './leads-funnel.service';
import { AppConfigService } from '../config/app-config.service';
import { B2bLeadScopeService, type B2bListScope } from '../b2b-projects/b2b-lead-scope.service';

@Controller('api/v1/leads')
@UseGuards(LeadsFunnelEnabledGuard)
export class LeadsFunnelController {
  constructor(
    private readonly funnel: LeadsFunnelService,
    private readonly staffAuth: StaffAuthService,
    private readonly appConfig: AppConfigService,
    private readonly b2bLeadScope: B2bLeadScopeService,
  ) {}

  private actor(req: Request & { staffUser?: StaffJwtPayload }): string {
    return String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
  }

  private userId(req: Request & { staffUser?: StaffJwtPayload }): Promise<number | null> {
    return this.staffAuth.resolveCrmStaffUserId(req.staffUser);
  }

  private async b2bReviewQueueScope(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ): Promise<B2bListScope | undefined> {
    if (req.staffAuthVia === 'internal' || !req.staffUser || !this.appConfig.b2bProjectOs) {
      return undefined;
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null) return undefined;
    return this.b2bLeadScope.buildListScope({
      staffId,
      caps: me.caps,
      positionCode: me.position_code,
    });
  }

  private badRequest(err: unknown): never {
    if (err instanceof ForbiddenException) throw err;
    if (err instanceof HttpException) throw err;
    const msg = extractHttpErrorMessage(err);
    throw new HttpException({ error: msg, message: msg }, HttpStatus.BAD_REQUEST);
  }

  @Get('review-queue/count')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async reviewQueueCount(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    return this.funnel.reviewQueueCount(await this.b2bReviewQueueScope(req));
  }

  @Get('review-queue/metrics')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async reviewQueueMetrics(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('limit') limit?: string,
  ) {
    const scope = await this.b2bReviewQueueScope(req);
    return this.funnel.reviewQueueMetrics(limit ? Number(limit) : undefined, scope);
  }

  @Get('review-queue/assignees')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  listReviewAssignees() {
    return this.funnel.listReviewAssignees();
  }

  @Get('review-queue')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async listReviewQueue(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    const scope = await this.b2bReviewQueueScope(req);
    return this.funnel.listReviewQueue(Number.isFinite(lim) ? lim : 50, scope);
  }

  /** Phase 2 — review queue AI summary + suggested owner (rules, BR-AI-018). */
  @Get('review-queue/ai-summaries')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async listReviewQueueAiSummaries(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('limit') limit?: string,
    @Query('mode') mode?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    const triageMode = mode === 'llm' ? 'llm' : 'rules';
    const scope = await this.b2bReviewQueueScope(req);
    return this.funnel.listReviewQueueAiSummaries(
      Number.isFinite(lim) ? lim : 50,
      triageMode,
      scope,
    );
  }

  @Post('review-queue/sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalKeyGuard)
  syncReviewQueue(
    @Query('dry_run') dryRun?: string,
    @Req() req?: Request & { staffUser?: StaffJwtPayload },
  ) {
    const actor = req ? this.actor(req) : 'system:b2_review';
    return this.funnel.syncReviewQueue(actor, dryRun === '1' || dryRun === 'true');
  }

  @Get(':id/funnel')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getFunnel(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getFunnel(id);
  }

  @Get(':id/care-pipeline')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getCarePipeline(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getCarePipeline(id);
  }

  @Post(':id/care-pipeline/report')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  async submitCareReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CompleteCareStageBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.submitCareReport(
        id,
        body,
        this.actor(req),
        await this.userId(req),
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/care-pipeline/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  completeCareStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CompleteCareStageBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return this.funnel.completeCareStage(id, body, this.actor(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/review-queue/release')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsGdkdGuard)
  releaseReviewQueue(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReleaseReviewQueueBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return this.funnel.releaseReviewQueue(id, body, this.actor(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresales(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresales(id);
  }

  @Post(':id/presales')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  ensurePresales(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EnsurePresalesBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return this.funnel.ensurePresales(id, body, this.actor(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/consult-gate')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getConsultGate(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getConsultAdvanceGate(id);
  }

  @Post(':id/presales/advance')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async advancePresales(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdvancePresalesBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      const allowOverride = req.staffUser
        ? await this.funnel.staffHasAssignCap(req.staffUser)
        : false;
      return this.funnel.advancePresales(id, body, allowOverride, req.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/handoff-solution')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async handoffToSolution(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: HandoffSolutionBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.handoffToSolution(
        id,
        body,
        await this.userId(req),
        this.actor(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/policy-preview')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async presalesPolicyPreview(
    @Param('id', ParseIntPipe) id: number,
    @Query('action') action: string,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const act = String(action ?? 'release').trim().toLowerCase();
    if (act !== 'release' && act !== 'claim') {
      throw new HttpException({ error: 'invalid_action' }, HttpStatus.BAD_REQUEST);
    }
    return this.funnel.previewPresalesPolicy(id, act, req.staffUser);
  }

  @Post(':id/presales/claim-solution')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
    StaffPresalesSolutionClaimGuard,
  )
  async claimSolution(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.claimSolution(
        id,
        await this.userId(req),
        this.actor(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/return-to-sales')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
    StaffPresalesSolutionClaimGuard,
  )
  async returnToSales(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReturnSolutionBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.returnToSalesForMissingInfo(
        id,
        await this.userId(req),
        String(body.reason ?? ''),
        this.actor(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/release-to-sales')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
    StaffPresalesSolutionReleaseGuard,
  )
  async releaseToSales(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.releaseToSales(
        id,
        await this.userId(req),
        this.actor(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/approve-solution')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async approveSolution(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.approveSubmittedSolution(id, await this.userId(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/request-solution-edits')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async requestSolutionEdits(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { note?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.requestSolutionEdits(id, await this.userId(req), String(body?.note ?? ''));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/accept-quote-case')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async acceptQuoteCase(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.acceptQuoteCase(id, await this.userId(req), req.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/send-quote-to-sales')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async sendQuoteToSales(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.sendQuoteToSales(id, await this.userId(req), req.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/approve-quote')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async approveQuote(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.approveQuote(id, await this.userId(req), req.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/request-quote-edits')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async requestQuoteEdits(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { note?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.requestQuoteEdits(id, await this.userId(req), String(body?.note ?? ''), req.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/transfer-quote-case')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async transferQuoteCase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { staff_id?: number },
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      if (!req.staffUser) {
        throw new ForbiddenException({ error: 'Chỉ CEO được chuyển case báo giá.' });
      }
      const me = await this.staffAuth.me(req.staffUser);
      return await this.funnel.transferQuoteCase(
        id,
        await this.userId(req),
        Number(body?.staff_id),
        me.position_code,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/create-contract')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async createQuoteContract(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.createQuoteContract(id, await this.userId(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/sign-contract')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async signQuoteContract(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.signQuoteContract(id, await this.userId(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/implementation-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async getImplementationPlan(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.funnel.getImplementationPlan(id);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/contract-docx')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async quoteContractDocx(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    try {
      const out = await this.funnel.quoteContractDocx(id);
      return new StreamableFile(out.buffer, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        disposition: `attachment; filename="${out.filename}"`,
        length: out.buffer.length,
      });
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/delivery-kpi')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async getDeliveryKpi(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.funnel.getDeliveryKpi(id);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/quote-sheet')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async getQuoteSheet(@Param('id', ParseIntPipe) id: number, @Query('services') services?: string, @Req() req?: Request & { staffUser?: StaffJwtPayload }) {
    try {
      return await this.funnel.getQuoteSheet(id, services, req?.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/quote-sheet/xlsx')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async quoteSheetXlsx(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { staffUser?: StaffJwtPayload }): Promise<StreamableFile> {
    try {
      const out = await this.funnel.quoteSheetXlsx(id, req.staffUser);
      return new StreamableFile(out.buffer, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: `attachment; filename="${out.filename}"`,
        length: out.buffer.length,
      });
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/quote-sheet/pdf')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async quoteSheetPdf(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { staffUser?: StaffJwtPayload }): Promise<StreamableFile> {
    try {
      const out = await this.funnel.quoteSheetPdf(id, req.staffUser);
      return new StreamableFile(out.buffer, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        disposition: `attachment; filename="${out.filename}"`,
        length: out.buffer.length,
      });
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Put(':id/presales/quote-sheet')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async saveQuoteSheet(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { service_codes?: unknown; lines?: unknown; vat_percent?: unknown; promo_percent?: unknown },
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.saveQuoteSheet(id, await this.userId(req), body ?? {}, req.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Patch(':id/presales/tasks/:taskId')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async patchPresalesTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: PatchPresalesTaskBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.patchPresalesTask(id, taskId, body, await this.userId(req), req.staffUser);
  }

  @Get(':id/presales/marketing-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getMarketingPlan(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getMarketingPlan(id);
  }

  @Patch(':id/presales/marketing-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  patchMarketingPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchMarketingPlanBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.patchMarketingPlan(id, body, req.staffUser);
  }

  @Get(':id/presales/client-brief')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getClientBrief(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getClientBrief(id);
  }

  @Patch(':id/presales/client-brief')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  patchClientBrief(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchClientBriefBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.patchClientBrief(id, body, req.staffUser);
  }

  @Post(':id/presales/client-brief/suggest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    StaffConsultAiGenerateGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
  )
  suggestClientBriefFacts(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.suggestClientBriefFacts(id, req.staffUser);
  }

  @Post(':id/presales/marketing-plan/ai-draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    StaffConsultAiGenerateGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
  )
  generatePresalesMarketingPlanAiDraft(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.generatePresalesMarketingPlanAiDraft(id, req.staffUser);
  }

  @Post(':id/presales/client-plan/export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async exportClientPlan(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Res({ passthrough: true }) res: Response,
  ) {
    let maskForeignContactForStaffId: number | null = null;
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const viewAll =
        this.staffAuth.hasCap(me.caps, 'crm_gdkd', 'view_all_leads') ||
        String(me.position_code ?? '').toLowerCase() === 'super-admin';
      if (!viewAll && isAccountManagerPosition(me.position_code)) {
        maskForeignContactForStaffId = await this.userId(req);
      }
    }
    const out = await this.funnel.exportClientPlan(id, { maskForeignContactForStaffId });
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return {
      ok: true,
      filename: out.filename,
      note: out.note,
      pptx_base64: out.pptx.toString('base64'),
      pdf_filename: out.pdfFilename,
      pdf_base64: out.pdf ? out.pdf.toString('base64') : null,
    };
  }

  @Get(':id/presales/consult-brief')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesConsultBrief(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesConsultBrief(id);
  }

  @Post(':id/presales/consult-prefill')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  prefillPresalesConsult(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ConsultPrefillBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.prefillPresalesConsult(id, body, req.staffUser);
  }

  @Get(':id/presales/proposal-gate')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesProposalGate(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesProposalGate(id);
  }

  @Get(':id/presales/proposal-handoff')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesProposalHandoff(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesProposalHandoff(id);
  }

  @Get('presales/implementation-queue')
  @UseGuards(StaffOrInternalKeyGuard, StaffPresalesSolutionQueueGuard, PresalesOnLeadGuard)
  async listImplementationQueue(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    return this.funnel.listImplementationQueue(status?.trim(), Number.isFinite(lim) ? lim : 50);
  }

  @Post(':id/presales/claim-implementation')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async claimImplementation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.claimImplementationHandoff(
        id,
        await this.userId(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get('presales/solution-queue')
  @UseGuards(StaffOrInternalKeyGuard, StaffPresalesSolutionQueueGuard, PresalesOnLeadGuard)
  async listSolutionQueue(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    let ownerStaffId: number | null | undefined;
    let includeAmRework = false;
    let maskForeignPhoneForStaffId: number | null = null;
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const viewAll =
        this.staffAuth.hasCap(me.caps, 'crm_gdkd', 'view_all_leads') ||
        String(me.position_code ?? '').toLowerCase() === 'super-admin';
      const isAccountManager = isAccountManagerPosition(me.position_code);
      const isMarketingLeader = isMarketingLeaderPosition(me.position_code);
      if (!viewAll && isMarketingLeader && !isAccountManager) {
        return { ok: true, rows: [], count: 0 };
      }
      if (!viewAll && !isAccountManager && !isMarketingLeader) {
        ownerStaffId = await this.userId(req);
        includeAmRework = true;
      } else if (!viewAll && isAccountManager) {
        maskForeignPhoneForStaffId = await this.userId(req);
      }
    }
    const listed = await this.funnel.listSolutionQueue(status?.trim(), Number.isFinite(lim) ? lim : 50, {
      ownerStaffId,
      includeAmRework,
    });
    if (maskForeignPhoneForStaffId == null) return listed;
    return {
      ...listed,
      rows: listed.rows.map((row) =>
        Number(row.owner_id) === Number(maskForeignPhoneForStaffId)
          ? row
          : { ...row, phone: maskPartialPii(row.phone) },
      ),
    };
  }

  @Get('presales/consult-sla/summary')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesConsultSlaSummary(@Query('am_id') amId?: string) {
    const parsed = amId != null && amId !== '' ? Number(amId) : null;
    return this.funnel.getPresalesConsultSlaSummary(
      parsed != null && Number.isFinite(parsed) ? parsed : null,
    );
  }

  @Get('presales/funnel-metrics')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesFunnelMetrics(
    @Query('period_start') periodStart?: string,
    @Query('period_end') periodEnd?: string,
    @Query('am_id') amId?: string,
  ) {
    const parsedAm = amId != null && amId !== '' ? Number(amId) : null;
    return this.funnel.getPresalesFunnelMetrics({
      periodStart: periodStart?.trim() || null,
      periodEnd: periodEnd?.trim() || null,
      amId: parsedAm != null && Number.isFinite(parsedAm) ? parsedAm : null,
    });
  }

  @Post('presales/batch-upgrade-workflow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalKeyGuard)
  batchUpgradePresalesWorkflow(@Body() body: BatchUpgradePresalesWorkflowBody) {
    return this.funnel.batchUpgradePresalesWorkflow(body);
  }

  @Post(':id/presales/consult-sla/reminder')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async createPresalesConsultSlaReminder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PresalesConsultSlaReminderBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.createPresalesConsultSlaReminder(
      id,
      body,
      this.actor(req),
      await this.userId(req),
    );
  }

  @Patch(':id/presales/l2-docs')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  patchPresalesL2Docs(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchPresalesL2DocsBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.patchPresalesL2Docs(id, body, req.staffUser);
  }

  @Post(':id/presales/tasks/:taskId/ai-assist')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  runPresalesTaskAiAssist(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: PresalesAiAssistBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.runPresalesTaskAiAssist(id, taskId, body, req.staffUser);
  }

  @Post(':id/presales/upgrade-workflow-template')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  upgradePresalesWorkflowTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpgradePresalesWorkflowBody,
  ) {
    return this.funnel.upgradePresalesWorkflowTemplate(id, body);
  }
}
