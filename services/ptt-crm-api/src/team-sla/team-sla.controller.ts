import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  LeadSlaAccess,
  StaffLeadSlaEditGuard,
  StaffLeadSlaViewGuard,
} from '../lead-sla-settings/guards/staff-lead-sla.guard';
import { TeamSlaService } from './team-sla.service';

type TeamSlaReq = {
  staffUser?: StaffJwtPayload;
  leadSlaAccess?: LeadSlaAccess;
};

@Controller('api/admin/team-sla')
@UseGuards(StaffOrInternalKeyGuard)
export class TeamSlaController {
  constructor(private readonly service: TeamSlaService) {}

  private actor(req: TeamSlaReq): string {
    return String(req.staffUser?.email ?? req.staffUser?.sub ?? 'staff');
  }

  @Get()
  @UseGuards(StaffLeadSlaViewGuard)
  async get() {
    const out = await this.service.getSettings();
    return {
      ...out.document,
      updated_by: out.updated_by,
      updated_at: out.updated_at,
    };
  }

  @Put()
  @UseGuards(StaffLeadSlaEditGuard)
  async put(@Req() req: TeamSlaReq, @Body() body: unknown) {
    const out = await this.service.saveDocument(body, this.actor(req));
    return {
      ...out.document,
      updated_by: out.updated_by,
      updated_at: out.updated_at,
    };
  }
}

/** Authenticated sales staff need the clocks on the lead page (claim banner / countdown). */
@Controller('api/team-sla')
@UseGuards(StaffOrInternalKeyGuard)
export class TeamSlaPublicController {
  constructor(private readonly service: TeamSlaService) {}

  @Get()
  async get() {
    const document = await this.service.getDocument();
    return document;
  }
}
