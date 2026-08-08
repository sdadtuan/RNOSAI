import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffMarketingAiPlannerExportGuard,
  StaffMarketingAiPlannerGenerateGuard,
  StaffMarketingAiPlannerViewGuard,
} from './guards/staff-marketing-ai-planner.guard';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';
import type { MktAiDraft, MktAiJobType } from './marketing-ai-planner.types';

const RETRY_TYPE_MAP: Record<string, MktAiJobType> = {
  strategy: 'strategy_generate',
  campaigns: 'campaign_generate',
  content: 'content_generate',
  quality: 'quality_score',
};

function actorEmail(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/crm/service-lifecycle/:lifecycleId/ai-planner')
@UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlannerViewGuard)
export class MarketingAiPlannerController {
  constructor(private readonly planner: MarketingAiPlannerService) {}

  @Get('context')
  context(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.getContext(lifecycleId);
  }

  @Patch('brief')
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  patchBrief(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.planner.patchBrief(lifecycleId, body, actorEmail(req));
  }

  @Patch('draft')
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  patchDraft(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Partial<MktAiDraft>,
    @Req() req: Request,
  ) {
    return this.planner.patchDraft(lifecycleId, body, actorEmail(req));
  }

  @Post('jobs/strategy')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runStrategy(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runStrategyJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/campaigns')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runCampaigns(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runCampaignJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/content')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runContent(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runContentJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/quality')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runQuality(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runQualityJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/:type/retry')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  retryJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('type') type: string,
    @Req() req: Request,
  ) {
    const jobType = RETRY_TYPE_MAP[type];
    if (!jobType) {
      throw new BadRequestException({ error: 'invalid_job_type', job_type: type });
    }
    return this.planner.retryJob(lifecycleId, jobType, actorEmail(req));
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  apply(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.planner.applyToTmmt(lifecycleId, body, actorEmail(req));
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerExportGuard)
  exportPlan(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: { format?: string },
    @Req() req: Request,
  ) {
    return this.planner.exportPlan(lifecycleId, body?.format ?? 'pdf', actorEmail(req));
  }

  @Post('documents')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  uploadDocument() {
    throw new NotImplementedException({ error: 'mkt_ai_documents_phase2' });
  }

  @Post('jobs/budget-simulate')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  budgetSimulate() {
    throw new NotImplementedException({ error: 'mkt_ai_budget_simulate_phase2' });
  }

  @Get('approvals')
  listApprovals() {
    throw new NotImplementedException({ error: 'mkt_ai_approvals_phase2' });
  }

  @Post('approvals')
  createApproval() {
    throw new NotImplementedException({ error: 'mkt_ai_approvals_phase2' });
  }

  @Get('comments')
  listComments() {
    throw new NotImplementedException({ error: 'mkt_ai_comments_phase2' });
  }

  @Post('comments')
  createComment() {
    throw new NotImplementedException({ error: 'mkt_ai_comments_phase2' });
  }

  @Get('versions')
  listVersions() {
    throw new NotImplementedException({ error: 'mkt_ai_versions_phase2' });
  }

  @Post('versions/:versionId/restore')
  restoreVersion() {
    throw new NotImplementedException({ error: 'mkt_ai_versions_phase2' });
  }

  @Get('dashboard')
  dashboard() {
    throw new NotImplementedException({ error: 'mkt_ai_dashboard_phase3' });
  }

  @Post('jobs/optimize')
  optimize() {
    throw new NotImplementedException({ error: 'mkt_ai_optimize_phase3' });
  }

  @Post('jobs/multi-agent')
  multiAgent() {
    throw new NotImplementedException({ error: 'mkt_ai_multi_agent_phase4' });
  }
}
