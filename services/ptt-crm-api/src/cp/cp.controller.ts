import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { emptyKpis } from './cp.types';
import { RequireCpAction, StaffCpGuard } from './guards/staff-cp.guard';

@Controller('api/crm/cp')
@UseGuards(StaffOrInternalKeyGuard, StaffCpGuard)
export class CpController {
  @Get('overview/kpis')
  @RequireCpAction('view')
  kpis() {
    return { last_updated: null, kpis: emptyKpis(), filters: {} };
  }
}
