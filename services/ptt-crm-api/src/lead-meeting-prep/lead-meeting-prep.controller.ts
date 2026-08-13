import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffLmpRunGuard, StaffLmpViewGuard } from './guards/staff-lmp.guard';
import { LeadMeetingPrepEnabledGuard } from './guards/lead-meeting-prep-enabled.guard';
import type { RunLeadMeetingPrepBody, SelectEntityBody } from './lead-meeting-prep.types';
import { LeadMeetingPrepService } from './lead-meeting-prep.service';

@Controller('api/v1/leads')
@UseGuards(LeadMeetingPrepEnabledGuard)
export class LeadMeetingPrepController {
  constructor(private readonly prep: LeadMeetingPrepService) {}

  @Get(':id/meeting-prep')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpViewGuard)
  getMeetingPrep(@Param('id', ParseIntPipe) id: number) {
    return this.prep.getMeetingPrep(id);
  }

  @Post(':id/meeting-prep/run')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpRunGuard)
  runMeetingPrep(@Param('id', ParseIntPipe) id: number, @Body() body: RunLeadMeetingPrepBody) {
    return this.prep.runMeetingPrep(id, body ?? {});
  }

  @Post(':id/meeting-prep/select-entity')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpRunGuard)
  selectEntity(@Param('id', ParseIntPipe) id: number, @Body() body: SelectEntityBody) {
    return this.prep.selectEntity(id, body);
  }
}
