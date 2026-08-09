import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { ContentAuditService } from './content-audit.service';
import { ContentCalendarService } from './content-calendar.service';
import { ContentEmailBridgeService } from './content-email-bridge.service';
import { ContentGenerateService } from './content-generate.service';
import { ContentIdeaService } from './content-idea.service';
import { ContentItemService } from './content-item.service';
import { ContentPlanSnapshotService } from './content-plan-snapshot.service';
import { ContentProductionService } from './content-production.service';
import { ContentRepurposeService } from './content-repurpose.service';
import { ContentSeoBridgeService } from './content-seo-bridge.service';
import { ContentWorkflowService } from './content-workflow.service';
import { ContentMarketingService } from './content-marketing.service';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingGenerateGuard,
  StaffContentMarketingProductionGuard,
  StaffContentMarketingPublishGuard,
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from './guards/staff-content-marketing.guard';

function actorEmail(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/crm/service-lifecycle/:lifecycleId/content-marketing')
@UseGuards(StaffOrInternalKeyGuard, StaffContentMarketingViewGuard)
export class ContentMarketingController {
  constructor(
    private readonly contentMarketing: ContentMarketingService,
    private readonly ideas: ContentIdeaService,
    private readonly items: ContentItemService,
    private readonly snapshots: ContentPlanSnapshotService,
    private readonly generate: ContentGenerateService,
    private readonly workflow: ContentWorkflowService,
    private readonly calendar: ContentCalendarService,
    private readonly audit: ContentAuditService,
    private readonly repurpose: ContentRepurposeService,
    private readonly seoBridge: ContentSeoBridgeService,
    private readonly emailBridge: ContentEmailBridgeService,
    private readonly production: ContentProductionService,
  ) {}

  @Get('context')
  context(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.contentMarketing.getContext(lifecycleId);
  }

  @Get('plan-snapshot')
  planSnapshot(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.snapshots.getPlanSnapshot(lifecycleId);
  }

  @Post('plan-snapshot/ingest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  ingestPlanSnapshot(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.snapshots.ingestPlanSnapshot(lifecycleId, body, actorEmail(req));
  }

  @Post('plan-snapshot/seal')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  sealPlanSnapshot(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.snapshots.sealPlanSnapshot(lifecycleId);
  }

  @Get('ideas')
  listIdeas(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('status') status?: string,
    @Query('pillar_id') pillarId?: string,
  ) {
    return this.ideas.listIdeas(lifecycleId, {
      status: status || undefined,
      pillar_id: pillarId != null && pillarId !== '' ? Number(pillarId) : undefined,
    });
  }

  @Post('ideas')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ideas.createIdea(lifecycleId, body, actorEmail(req));
  }

  @Patch('ideas/:ideaId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('ideaId', ParseIntPipe) ideaId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ideas.patchIdea(lifecycleId, ideaId, body);
  }

  @Post('ideas/:ideaId/convert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  convertIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('ideaId', ParseIntPipe) ideaId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ideas.convertIdea(lifecycleId, ideaId, body, actorEmail(req));
  }

  @Get('items')
  listItems(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('status') status?: string,
    @Query('format') format?: string,
    @Query('assignee') assignee?: string,
  ) {
    return this.items.listItems(lifecycleId, {
      status: status || undefined,
      format: format || undefined,
      assignee: assignee != null && assignee !== '' ? Number(assignee) : undefined,
    });
  }

  @Get('items/:itemId')
  getItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.items.getItem(lifecycleId, itemId);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.createItem(lifecycleId, body, actorEmail(req));
  }

  @Patch('items/:itemId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.patchItem(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('items/:itemId/versions')
  listItemVersions(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.items.listItemVersions(lifecycleId, itemId);
  }

  @Post('items/:itemId/jobs/draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startDraftJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.generate.startDraftJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/variants')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startVariantsJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.generate.startVariantsJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('jobs/:jobId')
  getJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.generate.getJob(lifecycleId, jobId);
  }

  @Post('jobs/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  cancelJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.generate.cancelJob(lifecycleId, jobId);
  }

  @Post('items/:itemId/submit-review')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  submitReview(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.workflow.submitReview(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  approveItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.workflow.approve(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  rejectItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.workflow.reject(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingPublishGuard)
  publishItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.publishItem(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('review-queue')
  listReviewQueue(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('sla_breach') slaBreach?: string,
    @Query('channel') channel?: string,
  ) {
    return this.workflow.listReviewQueue(lifecycleId, {
      sla_breach: slaBreach === '1' || slaBreach === 'true',
      channel: channel || undefined,
    });
  }

  @Get('review-queue/summary')
  reviewQueueSummary(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.workflow.reviewQueueSummary(lifecycleId);
  }

  @Get('calendar')
  listCalendar(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendar.listCalendar(lifecycleId, { from, to });
  }

  @Put('calendar/slots/:itemId')
  @UseGuards(StaffContentMarketingWriteGuard)
  upsertCalendarSlot(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.calendar.upsertSlot(lifecycleId, itemId, body, actorEmail(req));
  }

  @Delete('calendar/slots/:itemId')
  @UseGuards(StaffContentMarketingWriteGuard)
  deleteCalendarSlot(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.calendar.deleteSlot(lifecycleId, itemId);
  }

  @Get('audit')
  listAudit(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('limit') limit?: string,
  ) {
    const n = limit != null && limit !== '' ? Number(limit) : 50;
    return this.audit.listAudit(lifecycleId, n);
  }

  @Post('items/:itemId/repurpose')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  repurposeItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.repurpose.repurpose(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('items/:itemId/derivations')
  listDerivations(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.repurpose.listDerivations(lifecycleId, itemId);
  }

  @Post('items/:itemId/bridge/seo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  bridgeSeo(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.seoBridge.bridgeSeo(lifecycleId, itemId, actorEmail(req));
  }

  @Get('items/:itemId/bridge/seo/status')
  seoBridgeStatus(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.seoBridge.getSeoBridgeStatus(lifecycleId, itemId);
  }

  @Post('items/:itemId/bridge/email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  bridgeEmail(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.emailBridge.bridgeEmail(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('items/:itemId/bridge/email/status')
  emailBridgeStatus(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.emailBridge.getEmailBridgeStatus(lifecycleId, itemId);
  }

  @Get('items/:itemId/production')
  getProduction(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.production.getProduction(lifecycleId, itemId);
  }

  @Patch('items/:itemId/production')
  @UseGuards(StaffContentMarketingProductionGuard)
  patchProduction(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.production.patchProduction(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/production/done')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  markProductionDone(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.production.markProductionDone(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/link/creative')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  linkCreative(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.production.linkCreative(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/export/brief-design')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  exportDesignBrief(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.production.exportDesignBrief(lifecycleId, itemId);
  }

  @Post('items/:itemId/export/script')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  exportScript(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.production.exportScript(lifecycleId, itemId);
  }
}
