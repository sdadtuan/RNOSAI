import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import { LeadFrSlaService, type LogCallBody } from './lead-fr-sla.service';

@Controller('api/crm/leads')
@UseGuards(StaffOrInternalKeyGuard)
export class LeadFrSlaController {
  constructor(private readonly service: LeadFrSlaService) {}

  private actor(req: { staffUser?: StaffJwtPayload }): string {
    return String(req.staffUser?.email ?? req.staffUser?.sub ?? 'staff');
  }

  @Get(':id/fr-sla')
  @UseGuards(StaffLeadsViewGuard)
  read(@Param('id') id: string) {
    return this.service.readSla(Number(id));
  }

  @Post(':id/call-attempts')
  @UseGuards(StaffLeadsWriteGuard)
  logCall(
    @Param('id') id: string,
    @Body() body: LogCallBody,
    @Req() req: { staffUser?: StaffJwtPayload },
  ) {
    return this.service.logCall(Number(id), body, this.actor(req));
  }
}
