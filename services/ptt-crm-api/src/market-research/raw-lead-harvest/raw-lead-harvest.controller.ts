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
import type {
  BulkAcceptRawLeadsBody,
  CreateRawLeadHarvestBody,
  EnrichRawLeadsContactsBody,
  ExportRawLeadsBody,
  PatchRawLeadBody,
  PushRawLeadsBody,
  ReclassifyRawLeadsBody,
  RecomputePriorityBody,
} from './raw-lead-harvest.types';

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

  @Get('market-entities/summary')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  marketEntitiesSummary(
    @Query() query: { industry_key?: string; province_code?: string },
  ) {
    return this.harvest.getMarketEntitiesSummary(
      String(query.industry_key ?? ''),
      String(query.province_code ?? ''),
    );
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
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.harvest.listLeads(id, query);
  }

  @Get('projects/:id/raw-leads/readiness-counts')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  readinessCounts(@Param('id', ParseIntPipe) id: number) {
    return this.harvest.readinessCounts(id);
  }

  @Get('projects/:id/raw-leads/priority-counts')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  priorityCounts(@Param('id', ParseIntPipe) id: number) {
    return this.harvest.priorityCounts(id);
  }

  @Post('projects/:id/raw-leads/recompute-priority')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  recomputePriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RecomputePriorityBody,
  ) {
    return this.harvest.recomputePriority(id, body ?? {});
  }

  @Post('projects/:id/raw-leads/reclassify-readiness')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  reclassifyReadiness(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReclassifyRawLeadsBody,
  ) {
    return this.harvest.reclassifyReadiness(id, body ?? {});
  }

  @Post('projects/:id/raw-leads/enrich-contacts')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  enrichContacts(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EnrichRawLeadsContactsBody,
  ) {
    return this.harvest.enrichContacts(id, body ?? {});
  }

  @Post('projects/:id/raw-leads/bulk-accept')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  bulkAccept(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BulkAcceptRawLeadsBody,
  ) {
    return this.harvest.bulkAccept(id, body ?? { lead_ids: [] }, staffId(req));
  }

  @Patch('projects/:id/raw-leads/:leadId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  patchLead(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: PatchRawLeadBody,
  ) {
    return this.harvest.patchLead(id, leadId, body, staffId(req));
  }

  @Post('projects/:id/raw-leads/export')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  exportLeads(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ExportRawLeadsBody,
  ) {
    return this.harvest.exportLeads(id, body ?? {});
  }

  @Post('projects/:id/raw-leads/push-crm')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  pushCrm(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PushRawLeadsBody,
  ) {
    return this.harvest.pushToCrm(id, body);
  }
}
