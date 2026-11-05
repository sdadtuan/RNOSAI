import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { B2bOrphanFirstAssignService } from '../webhooks/b2b-orphan-first-assign.service';
import { MetaLeadSyncService } from '../webhooks/meta-lead-sync.service';
import { StaffB2bProjectsManageGuard } from './guards/staff-b2b-projects.guard';

@Controller('api/v1/b2b-projects')
@UseGuards(StaffOrInternalKeyGuard)
export class B2bFacebookSyncController {
  constructor(
    private readonly sync: MetaLeadSyncService,
    private readonly orphanAssign: B2bOrphanFirstAssignService,
  ) {}

  @Post(':id/sync-facebook-leads')
  @UseGuards(StaffB2bProjectsManageGuard)
  syncFacebookLeads(
    @Param('id') id: string,
    @Body() body?: { form_id?: string; limit?: number },
  ) {
    return this.sync.syncProject(id, body ?? {});
  }

  @Post(':id/facebook-leadgen-forms')
  @UseGuards(StaffB2bProjectsManageGuard)
  listFacebookLeadgenForms(
    @Param('id') id: string,
    @Body() body?: { page_id?: string; access_token?: string },
  ) {
    return this.sync.listLeadgenForms(id, body ?? {});
  }

  /** Backfill: gán AE cho lead B2B đang owner_id NULL (sau khi chuyển Nest ingest). */
  @Post(':id/first-assign-unassigned')
  @UseGuards(StaffB2bProjectsManageGuard)
  firstAssignUnassigned(
    @Param('id') id: string,
    @Body() body?: { limit?: number },
  ) {
    return this.orphanAssign.assignUnassignedInProject(id, body ?? {});
  }
}
