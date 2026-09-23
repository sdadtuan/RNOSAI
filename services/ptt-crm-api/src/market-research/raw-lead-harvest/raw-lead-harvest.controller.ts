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
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import type { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import {
  StaffMarketResearchRunGuard,
  StaffMarketResearchViewGuard,
} from '../guards/staff-market-research.guard';
import { MarketResearchEnabledGuard } from '../guards/market-research-enabled.guard';
import { RawLeadHarvestService } from './raw-lead-harvest.service';
import type {
  AssignCareRawLeadsBody,
  BulkAcceptRawLeadsBody,
  CareContactBody,
  CreateRawLeadHarvestBody,
  EnrichRawLeadsContactsBody,
  ExportRawLeadsBody,
  PatchRawLeadBody,
  PushRawLeadsBody,
  ReclassifyRawLeadsBody,
  RecomputePriorityBody,
  ApplyLearningBody,
  MergeAccountsBody,
} from './raw-lead-harvest.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload };

@Controller('api/v1/research')
@UseGuards(MarketResearchEnabledGuard)
export class RawLeadHarvestController {
  constructor(
    private readonly harvest: RawLeadHarvestService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  /** JWT `sub` may be UUID — map to crm_staff.id for care/assign APIs. */
  private async crmStaffId(req: StaffReq): Promise<number | null> {
    return this.staffAuth.resolveCrmStaffUserId(req.staffUser);
  }

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
  async create(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateRawLeadHarvestBody,
  ) {
    return this.harvest.createJob(id, body, await this.crmStaffId(req));
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

  @Get('projects/:id/raw-leads/care-counts')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  careCounts(@Param('id', ParseIntPipe) id: number) {
    return this.harvest.careCounts(id);
  }

  @Post('projects/:id/raw-leads/assign-care')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async assignCare(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignCareRawLeadsBody,
  ) {
    return this.harvest.assignCare(id, body ?? {}, await this.crmStaffId(req));
  }

  @Post('projects/:id/raw-leads/revoke-care')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  revokeCare(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { lead_ids?: number[] },
  ) {
    return this.harvest.revokeCare(id, body ?? {});
  }

  /** AE inbox — assigned raw leads across projects. */
  @Get('raw-leads/my-care')
  @UseGuards(StaffOrInternalKeyGuard)
  async myCare(@Req() req: StaffReq) {
    return this.harvest.listMyCare(await this.crmStaffId(req));
  }

  @Post('raw-leads/:leadId/care-contact')
  @UseGuards(StaffOrInternalKeyGuard)
  async careContact(
    @Req() req: StaffReq,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: CareContactBody,
  ) {
    return this.harvest.setMyCareContact(
      leadId,
      await this.crmStaffId(req),
      body ?? {},
    );
  }

  @Post('raw-leads/:leadId/promote-b2b')
  @UseGuards(StaffOrInternalKeyGuard)
  async promoteB2b(
    @Req() req: StaffReq,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: { b2b_project_id?: string },
  ) {
    return this.harvest.promoteMyCareToB2b(
      leadId,
      await this.crmStaffId(req),
      body ?? {},
    );
  }

  @Get('projects/:id/raw-leads/:leadId/battlecard')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  battlecard(
    @Param('id', ParseIntPipe) id: number,
    @Param('leadId', ParseIntPipe) leadId: number,
  ) {
    return this.harvest.getBattlecard(id, leadId);
  }

  @Get('projects/:id/raw-leads/:leadId/cross-project-mates')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  crossProjectMates(
    @Param('id', ParseIntPipe) id: number,
    @Param('leadId', ParseIntPipe) leadId: number,
  ) {
    return this.harvest.crossProjectMates(id, leadId);
  }

  @Get('projects/:id/raw-leads/:leadId/research-account')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  researchAccount(
    @Param('id', ParseIntPipe) id: number,
    @Param('leadId', ParseIntPipe) leadId: number,
  ) {
    return this.harvest.getResearchAccountForLead(id, leadId);
  }

  @Post('projects/:id/raw-leads/merge-accounts')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  mergeAccounts(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MergeAccountsBody,
  ) {
    return this.harvest.mergeAccounts(id, body ?? {});
  }

  @Post('projects/:id/raw-leads/recompute-priority')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  recomputePriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RecomputePriorityBody,
  ) {
    return this.harvest.recomputePriority(id, body ?? {});
  }

  @Post('projects/:id/raw-leads/apply-learning')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  applyLearning(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApplyLearningBody,
  ) {
    return this.harvest.applyLearning(id, body ?? {});
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
  async bulkAccept(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BulkAcceptRawLeadsBody,
  ) {
    return this.harvest.bulkAccept(
      id,
      body ?? { lead_ids: [] },
      await this.crmStaffId(req),
    );
  }

  @Patch('projects/:id/raw-leads/:leadId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async patchLead(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: PatchRawLeadBody,
  ) {
    return this.harvest.patchLead(id, leadId, body, await this.crmStaffId(req));
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
