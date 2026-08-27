import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { MetaLeadSyncService } from '../webhooks/meta-lead-sync.service';
import { StaffB2bProjectsManageGuard } from './guards/staff-b2b-projects.guard';

@Controller('api/v1/b2b-projects')
@UseGuards(StaffOrInternalKeyGuard)
export class B2bFacebookSyncController {
  constructor(private readonly sync: MetaLeadSyncService) {}

  @Post(':id/sync-facebook-leads')
  @UseGuards(StaffB2bProjectsManageGuard)
  syncFacebookLeads(
    @Param('id') id: string,
    @Body() body?: { form_id?: string; limit?: number },
  ) {
    return this.sync.syncProject(id, body ?? {});
  }
}
