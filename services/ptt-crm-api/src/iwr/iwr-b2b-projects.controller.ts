import { Controller, Get, UseGuards } from '@nestjs/common';
import { B2bProjectsService } from '../b2b-projects/b2b-projects.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';

/** Name catalog for report pickers. Does not expose SLA, commission, or project admin. */
@Controller('api/crm/iwr/b2b-projects')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrB2bProjectsController {
  constructor(private readonly projects: B2bProjectsService) {}

  @Get()
  @RequireIwrAction('view')
  async list() {
    const rows = await this.projects.list();
    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        status: row.status,
      })),
    };
  }
}
