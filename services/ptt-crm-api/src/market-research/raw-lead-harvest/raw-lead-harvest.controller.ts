import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import type { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import {
  StaffMarketResearchRunGuard,
  StaffMarketResearchViewGuard,
} from '../guards/staff-market-research.guard';
import { MarketResearchEnabledGuard } from '../guards/market-research-enabled.guard';
import { RawLeadHarvestService } from './raw-lead-harvest.service';
import type { CreateRawLeadHarvestBody, PatchRawLeadBody } from './raw-lead-harvest.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload };

function staffId(req: StaffReq): number | null {
  const n = Number(req.staffUser?.sub);
  return Number.isFinite(n) ? n : null;
}

@Controller('api/v1/research')
@UseGuards(MarketResearchEnabledGuard)
export class RawLeadHarvestController {
  constructor(private readonly harvest: RawLeadHarvestService) {}

  @Get('raw-lead-harvest/providers')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  providers() {
    return this.harvest.listHarvestProviders().then((providers) => ({ providers }));
  }

  @Post('projects/:id/raw-lead-harvests')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  create(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateRawLeadHarvestBody,
  ) {
    return this.harvest.createJob(id, body, staffId(req));
  }

  @Get('projects/:id/raw-lead-harvests')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  listJobs(@Param('id', ParseIntPipe) id: number) {
    return this.harvest.listJobs(id);
  }

  @Get('projects/:id/raw-lead-harvests/:jobId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  getJob(
    @Param('id', ParseIntPipe) id: number,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.harvest.getJob(id, jobId);
  }

  @Get('projects/:id/raw-leads')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  listLeads(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: { status?: string; job_id?: string; include_auto_rejected?: string },
  ) {
    return this.harvest.listLeads(id, query);
  }

  @Patch('projects/:id/raw-leads/:leadId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  patchLead(
    @Param('id', ParseIntPipe) id: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: PatchRawLeadBody,
  ) {
    return this.harvest.patchLead(id, leadId, body);
  }
}
