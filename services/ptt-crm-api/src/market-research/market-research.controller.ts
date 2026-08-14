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
  StaffMarketResearchCreateGuard,
  StaffMarketResearchEditGuard,
  StaffMarketResearchViewGuard,
} from './guards/staff-market-research.guard';
import { MarketResearchService } from './market-research.service';
import type {
  CreateEvidenceInput,
  CreateProjectInput,
  CreateQuestionInput,
  CreateSourceInput,
  PatchEvidenceInput,
  PatchProjectInput,
  PatchQuestionInput,
  PatchSourceInput,
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
    return { ok: true, enabled: true };
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
}
