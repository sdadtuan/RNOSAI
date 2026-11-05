import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffLeadSlaEditGuard,
  StaffLeadSlaPublishGuard,
  StaffLeadSlaViewGuard,
} from '../lead-sla-settings/guards/staff-lead-sla.guard';
import { LeadSlaDeskService } from './lead-sla-desk.service';
import type { LeadOpsTab } from './lead-sla-desk.types';
import { LeadSlaReassignService } from './lead-sla-reassign.service';

@Controller('api/crm/gdkd/lead-sla')
@UseGuards(StaffOrInternalKeyGuard)
export class LeadSlaGdkdController {
  constructor(
    private readonly reassignJob: LeadSlaReassignService,
    private readonly desk: LeadSlaDeskService,
  ) {}

  @Get('desk')
  @UseGuards(StaffLeadSlaViewGuard)
  deskSummary() {
    return this.desk.summary();
  }

  @Get('desk/leads')
  @UseGuards(StaffLeadSlaViewGuard)
  deskLeads(
    @Query('tab') tab?: string,
    @Query('limit') limit?: string,
  ) {
    const t = (['p0', 'p1', 'p2', 'p3'].includes(String(tab))
      ? tab
      : 'p0') as LeadOpsTab;
    return this.desk.listTab(t, limit ? Number(limit) : 80);
  }

  @Get('desk/pool')
  @UseGuards(StaffLeadSlaViewGuard)
  deskPool() {
    return this.desk.listPool();
  }

  @Post('desk/:leadId/reassign')
  @UseGuards(StaffLeadSlaEditGuard)
  reassign(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: { to_staff_id?: number; reason?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: string },
  ) {
    return this.desk.reassign(leadId, body ?? {}, this.actor(req));
  }

  @Post('desk/:leadId/extend-hold')
  @UseGuards(StaffLeadSlaEditGuard)
  extendHold(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: string },
  ) {
    return this.desk.extendHold(leadId, this.actor(req));
  }

  @Post('desk/:leadId/assign-from-queue')
  @UseGuards(StaffLeadSlaEditGuard)
  assignFromQueue(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: { to_staff_id: number },
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: string },
  ) {
    return this.desk.assignFromQueue(leadId, body, this.actor(req));
  }

  @Post('desk/:leadId/mark-invalid')
  @UseGuards(StaffLeadSlaEditGuard)
  markInvalid(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: { notes?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: string },
  ) {
    return this.desk.markInvalid(leadId, body ?? {}, this.actor(req));
  }

  @Get('reassign-events')
  @UseGuards(StaffLeadSlaViewGuard)
  listEvents(
    @Query('dry_run') dryRun?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    let dry: boolean | undefined;
    if (dryRun === undefined || dryRun === '') dry = undefined;
    else if (dryRun === '0' || dryRun === 'false') dry = false;
    else dry = dryRun === '1' || dryRun === 'true';
    return this.reassignJob.listAllEvents(
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
      dry,
    );
  }

  /** Manual tick for Bot/GĐKD verify (respects flags unless force=1 + publish cap). */
  @Post('reassign-job/run')
  @UseGuards(StaffLeadSlaPublishGuard)
  runJob(@Query('force') force?: string) {
    return this.reassignJob.run(new Date(), {
      force: force === '1' || force === 'true',
    });
  }

  private actor(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: string },
  ): string {
    if (req.staffAuthVia === 'internal') return 'internal';
    return String(req.staffUser?.email || req.staffUser?.sub || 'staff');
  }
}
