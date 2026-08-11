import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import {
  LeadsFunnelEnabledGuard,
  PresalesOnLeadGuard,
} from '../leads-funnel/guards/leads-funnel-enabled.guard';
import { DealRoomEnabledGuard } from './guards/deal-room-enabled.guard';
import { DealRoomService } from './deal-room.service';

@Controller('api/v1/leads')
@UseGuards(LeadsFunnelEnabledGuard, DealRoomEnabledGuard)
export class DealRoomController {
  constructor(private readonly dealRoom: DealRoomService) {}

  @Get(':id/deal-room')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getDealRoom(@Param('id', ParseIntPipe) id: number) {
    return this.dealRoom.getSnapshot(id);
  }
}
