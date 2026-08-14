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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { resolveStaffClientScope } from '../staff-client-scope/staff-client-scope.http.util';
import { MarketResearchEnabledGuard } from './guards/market-research-enabled.guard';
import {
  StaffMarketResearchApproveGuard,
  StaffMarketResearchCreateGuard,
  StaffMarketResearchEditGuard,
  StaffMarketResearchRunGuard,
  StaffMarketResearchViewGuard,
} from './guards/staff-market-research.guard';
import { MarketResearchService } from './market-research.service';
import type {
  ApproveInsightInput,
  AttachInsightEvidenceInput,
  CreateEvidenceInput,
  CreateInsightInput,
  CreateProjectInput,
  CreateQuestionInput,
  CreateSourceInput,
  InsightCopilotInput,
  PatchEvidenceInput,
  PatchInsightInput,
  PatchProjectInput,
  PatchQuestionInput,
  PatchSourceInput,
  ReportCopilotInput,
  RunDeepInput,
  RunDeskInput,
} from './market-research.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

function actorEmail(req: StaffReq): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/v1/research')
@UseGuards(MarketResearchEnabledGuard)
export class MarketResearchController {
  constructor(
    private readonly research: MarketResearchService,
    private readonly clientScope: StaffClientScopeService,
  ) {}

  @Get('health')
  health() {
    return this.research.health();
  }

  @Get('projects')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listProjects(
    @Req() req: StaffReq,
    @Query('client_id') clientId?: string,
    @Query('status') status?: string,
    @Query('product_type') productType?: string,
    @Query('q') q?: string,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listProjects(scope, {
      client_id: clientId,
      status,
      product_type: productType,
      q,
    });
  }

  @Post('projects')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchCreateGuard)
  async createProject(@Req() req: StaffReq, @Body() body: CreateProjectInput) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createProject(scope, body ?? ({} as CreateProjectInput), actorEmail(req));
  }

  @Get('projects/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getProject(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getProject(id, scope);
  }

  @Patch('projects/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchProject(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchProjectInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchProject(id, scope, body ?? {}, actorEmail(req));
  }

  @Post('projects/:id/questions')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async addQuestion(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateQuestionInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.addQuestion(id, scope, body ?? ({} as CreateQuestionInput));
  }

  @Patch('questions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchQuestion(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchQuestionInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchQuestion(id, scope, body ?? {});
  }

  @Delete('questions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async deleteQuestion(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.deleteQuestion(id, scope);
  }

  @Post('projects/:id/run-desk')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runDesk(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunDeskInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.runDesk(id, scope, body ?? ({} as RunDeskInput), actorEmail(req));
  }

  @Post('projects/:id/run-deep')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runDeep(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunDeepInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.runDeep(id, scope, body ?? ({} as RunDeepInput), actorEmail(req));
  }

  @Get('projects/:id/jobs/:runId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getJob(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('runId', ParseIntPipe) runId: number,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getJob(id, runId, scope);
  }

  @Post('projects/:id/sources')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createSource(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateSourceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createSource(id, scope, body ?? ({} as CreateSourceInput));
  }

  @Patch('sources/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchSource(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchSourceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchSource(id, scope, body ?? ({} as PatchSourceInput));
  }

  @Post('projects/:id/evidence')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createEvidence(id, scope, body ?? ({} as CreateEvidenceInput), actorEmail(req));
  }

  @Patch('evidence/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchEvidence(id, scope, body ?? {});
  }

  @Post('evidence/:id/verify')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async verifyEvidence(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.verifyEvidence(id, scope);
  }

  @Post('evidence/:id/supersede')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async supersedeEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.supersedeEvidence(id, scope, body ?? ({} as CreateEvidenceInput), actorEmail(req));
  }

  @Post('projects/:id/insights')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createInsight(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateInsightInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createInsight(id, scope, body ?? ({} as CreateInsightInput), actorEmail(req));
  }

  @Patch('insights/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchInsight(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchInsightInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchInsight(id, scope, body ?? {});
  }

  @Post('insights/:id/attach-evidence')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async attachInsightEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AttachInsightEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.attachEvidence(id, scope, body?.evidence_ids ?? []);
  }

  @Post('insights/:id/submit-review')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async submitInsightReview(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.submitReview(id, scope);
  }

  @Post('projects/:id/insights/copilot')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async insightCopilot(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: InsightCopilotInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.insightCopilot(id, scope, body ?? { evidence_ids: [] }, actorEmail(req));
  }

  @Post('projects/:id/reports/copilot')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async reportCopilot(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReportCopilotInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.reportCopilot(id, scope, body ?? { insight_ids: [] }, actorEmail(req));
  }

  @Post('insights/:id/approve')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchApproveGuard)
  async approveInsight(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApproveInsightInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.approveInsight(id, scope, body ?? ({} as ApproveInsightInput), actorEmail(req));
  }
}
