import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
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
  PatchMarketingPlanBody,
  PatchPresalesTaskBody,
  PresalesAiAssistBody,
  ReleaseReviewQueueBody,
  UpgradePresalesWorkflowBody,
} from './leads-funnel.types';
import { LeadsFunnelEnabledGuard, PresalesOnLeadGuard } from './guards/leads-funnel-enabled.guard';
import { StaffLeadsGdkdGuard } from './guards/staff-leads-gdkd.guard';
import { LeadNotInReviewQueueGuard } from './guards/lead-not-in-review-queue.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { LeadsFunnelService } from './leads-funnel.service';

@Controller('api/v1/leads')
@UseGuards(LeadsFunnelEnabledGuard)
export class LeadsFunnelController {
  constructor(
    private readonly funnel: LeadsFunnelService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private actor(req: Request & { staffUser?: StaffJwtPayload }): string {
    return String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
  }

  private userId(req: Request & { staffUser?: StaffJwtPayload }): Promise<number | null> {
    return this.staffAuth.resolveCrmStaffUserId(req.staffUser);
  }

  private badRequest(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpException({ error: msg, message: msg }, HttpStatus.BAD_REQUEST);
  }

  @Get('review-queue/count')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  reviewQueueCount() {
    return this.funnel.reviewQueueCount();
  }

  @Get('review-queue/metrics')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  reviewQueueMetrics(@Query('limit') limit?: string) {
    return this.funnel.reviewQueueMetrics(limit ? Number(limit) : undefined);
  }

  @Get('review-queue')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  listReviewQueue(@Query('limit') limit?: string) {
    const lim = limit ? Number(limit) : 50;
    return this.funnel.listReviewQueue(Number.isFinite(lim) ? lim : 50);
  }

  /** Phase 2 — review queue AI summary + suggested owner (rules, BR-AI-018). */
  @Get('review-queue/ai-summaries')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  listReviewQueueAiSummaries(
    @Query('limit') limit?: string,
    @Query('mode') mode?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    const triageMode = mode === 'llm' ? 'llm' : 'rules';
    return this.funnel.listReviewQueueAiSummaries(Number.isFinite(lim) ? lim : 50, triageMode);
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
      return this.funnel.advancePresales(id, body, allowOverride);
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
    return this.funnel.patchPresalesTask(id, taskId, body, await this.userId(req));
  }

  @Get(':id/presales/marketing-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getMarketingPlan(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getMarketingPlan(id);
  }

  @Patch(':id/presales/marketing-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  patchMarketingPlan(@Param('id', ParseIntPipe) id: number, @Body() body: PatchMarketingPlanBody) {
    return this.funnel.patchMarketingPlan(id, body);
  }

  @Get(':id/presales/consult-brief')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesConsultBrief(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesConsultBrief(id);
  }

  @Post(':id/presales/consult-prefill')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  prefillPresalesConsult(@Param('id', ParseIntPipe) id: number, @Body() body: ConsultPrefillBody) {
    return this.funnel.prefillPresalesConsult(id, body);
  }

  @Get(':id/presales/proposal-gate')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesProposalGate(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesProposalGate(id);
  }

  @Post(':id/presales/tasks/:taskId/ai-assist')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  runPresalesTaskAiAssist(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: PresalesAiAssistBody,
  ) {
    return this.funnel.runPresalesTaskAiAssist(id, taskId, body);
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
