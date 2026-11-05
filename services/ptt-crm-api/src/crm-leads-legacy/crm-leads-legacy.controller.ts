import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import { LeadNotInReviewQueueGuard } from '../leads-funnel/guards/lead-not-in-review-queue.guard';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { LeadsRepository } from '../leads/leads.repository';
import { LeadsWriteService } from '../leads/leads-write.service';
import { LeadStatusGatePatchOptions } from '../leads/lead-status-gate.service';
import { PatchLeadV1Body } from '../leads/leads.types';
import { CrmLeadsLegacyService } from './crm-leads-legacy.service';
import { LeadPatchFinalizeService } from '../leads/lead-patch-finalize.service';
import { LeadAttributionService } from '../leads/lead-attribution.service';
import { LeadAttributionResponse } from '../leads/lead-attribution.types';
import { AssignLeadBody, CreateLeadActivityBody } from './crm-leads-legacy.types';

@Controller('api/crm/leads')
@UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
export class CrmLeadsLegacyController {
  constructor(
    private readonly legacy: CrmLeadsLegacyService,
    private readonly leadsRepo: LeadsRepository,
    private readonly leadsWrite: LeadsWriteService,
    private readonly attribution: LeadAttributionService,
    private readonly staffAuth: StaffAuthService,
    private readonly leadPatchFinalize: LeadPatchFinalizeService,
  ) {}

  private actor(req: Request & { staffUser?: StaffJwtPayload }): string {
    return String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
  }

  private async statusGateOpts(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    body: PatchLeadV1Body,
  ): Promise<LeadStatusGatePatchOptions> {
    if (!body.allow_status_override) return {};
    if (req.staffAuthVia === 'internal') {
      return { allowStatusOverride: true };
    }
    if (!req.staffUser) return {};
    const me = await this.staffAuth.me(req.staffUser);
    const canAssign = this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign');
    return { allowStatusOverride: canAssign };
  }

  @Get(':id/attribution')
  async attributionForLead(@Param('id', ParseIntPipe) id: number): Promise<LeadAttributionResponse> {
    const data = await this.attribution.getLeadAttribution(id);
    return {
      data,
      meta: { request_id: this.attribution.newRequestId() },
      errors: [],
    };
  }

  @Get(':id/activities')
  listActivities(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Number(limit) : 100;
    return this.legacy.listActivities(id, Number.isFinite(lim) ? lim : 100).then((activities) => ({
      activities,
    }));
  }

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  async createActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateLeadActivityBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const userId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.legacy.createActivity(id, body, this.actor(req), userId);
  }

  @Get(':id/audit')
  audit(@Param('id', ParseIntPipe) id: number) {
    return this.legacy.auditLogs(id);
  }

  @Post(':id/assign')
  @UseGuards(StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignLeadBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.legacy.assignLead(id, body, this.actor(req));
  }

  @Patch(':id')
  @UseGuards(StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  async patchLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchLeadV1Body & { audit_note?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    const prev = await this.leadsRepo.getLeadById(id);
    if (!prev) {
      throw new NotFoundException({ error: 'Not found' });
    }
    const gateOpts = await this.statusGateOpts(req, body);
    const lead = await this.leadsWrite.patchLead(id, body, this.actor(req), gateOpts);
    await this.leadPatchFinalize.finalize({
      leadId: id,
      prev,
      next: lead,
      actor: this.actor(req),
      auditNote: body.audit_note ?? '',
    });
    return { lead };
  }
}
