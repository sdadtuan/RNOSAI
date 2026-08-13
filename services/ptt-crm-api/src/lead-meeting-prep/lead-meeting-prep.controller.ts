import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import { LeadMeetingPrepEnabledGuard } from './guards/lead-meeting-prep-enabled.guard';
import type { RunLeadMeetingPrepBody, SelectEntityBody } from './lead-meeting-prep.types';
import { LeadMeetingPrepService } from './lead-meeting-prep.service';

@Controller('api/v1/leads')
@UseGuards(LeadMeetingPrepEnabledGuard)
export class LeadMeetingPrepController {
  constructor(private readonly prep: LeadMeetingPrepService) {}

  @Get(':id/meeting-prep')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getMeetingPrep(@Param('id', ParseIntPipe) id: number) {
    return this.prep.getMeetingPrep(id);
  }

  @Post(':id/meeting-prep/run')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  runMeetingPrep(@Param('id', ParseIntPipe) id: number, @Body() body: RunLeadMeetingPrepBody) {
    return this.prep.runMeetingPrep(id, body ?? {});
  }

  @Post(':id/meeting-prep/select-entity')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  selectEntity(@Param('id', ParseIntPipe) id: number, @Body() body: SelectEntityBody) {
    return this.prep.selectEntity(id, body);
  }
}
