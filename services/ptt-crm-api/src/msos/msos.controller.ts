import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { RequireMsosAction, StaffMsosGuard } from './guards/staff-msos.guard';
import { MsosService } from './msos.service';

@Controller('api/crm/media-os')
@UseGuards(StaffOrInternalKeyGuard, StaffMsosGuard)
export class MsosController {
  constructor(private readonly msos: MsosService) {}

  @Get('health')
  @RequireMsosAction('view')
  health() {
    this.msos.assertEnabled();
    return this.msos.getHealth();
  }
}
