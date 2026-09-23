import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  LeadSlaAccess,
  StaffLeadSlaEditGuard,
  StaffLeadSlaPublishGuard,
  StaffLeadSlaViewGuard,
} from './guards/staff-lead-sla.guard';
import { LeadSlaSettingsService } from './lead-sla-settings.service';
import type { LeadSlaSettingsPayload } from './lead-sla-settings.defaults';

type LeadSlaReq = {
  staffUser?: StaffJwtPayload;
  leadSlaAccess?: LeadSlaAccess;
};

@Controller('api/admin/lead-sla-settings')
@UseGuards(StaffOrInternalKeyGuard)
export class LeadSlaSettingsController {
  constructor(private readonly service: LeadSlaSettingsService) {}

  private actor(req: LeadSlaReq): string {
    return String(req.staffUser?.email ?? req.staffUser?.sub ?? 'staff');
  }

  private caps(req: LeadSlaReq): LeadSlaAccess {
    return (
      req.leadSlaAccess ?? {
        canView: false,
        canEdit: false,
        canPublish: false,
        isSuperAdmin: false,
      }
    );
  }

  @Get()
  @UseGuards(StaffLeadSlaViewGuard)
  get(@Req() req: LeadSlaReq) {
    const caps = this.caps(req);
    return this.service.getSettings('default', {
      canEdit: caps.canEdit,
      canPublish: caps.canPublish,
    });
  }

  @Put()
  @UseGuards(StaffLeadSlaEditGuard)
  put(
    @Req() req: LeadSlaReq,
    @Body()
    body: {
      payload?: Partial<LeadSlaSettingsPayload>;
      publish?: boolean;
      note?: string;
      override_dry_run?: boolean;
    },
  ) {
    const caps = this.caps(req);
    return this.service.saveDraftOrPreview('default', body, this.actor(req), {
      canPublish: caps.canPublish,
      isSuperAdmin: caps.isSuperAdmin,
    });
  }

  @Post('publish')
  @UseGuards(StaffLeadSlaPublishGuard)
  publish(
    @Req() req: LeadSlaReq,
    @Body()
    body: {
      note: string;
      payload?: Partial<LeadSlaSettingsPayload>;
      override_dry_run?: boolean;
      reset_defaults?: boolean;
    },
  ) {
    const caps = this.caps(req);
    return this.service.publish('default', body, this.actor(req), {
      canPublish: caps.canPublish,
      isSuperAdmin: caps.isSuperAdmin,
    });
  }

  @Get('revisions')
  @UseGuards(StaffLeadSlaViewGuard)
  revisions(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listRevisions(
      'default',
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Post('revisions/:id/rollback')
  @UseGuards(StaffLeadSlaPublishGuard)
  rollback(
    @Req() req: LeadSlaReq,
    @Param('id') id: string,
    @Body() body: { note: string },
  ) {
    const caps = this.caps(req);
    return this.service.rollback('default', Number(id), body.note ?? '', this.actor(req), {
      canPublish: caps.canPublish,
      isSuperAdmin: caps.isSuperAdmin,
    });
  }

  @Post('recalc-hold')
  @UseGuards(StaffLeadSlaPublishGuard)
  async recalcHold(
    @Req() req: LeadSlaReq,
    @Body() body: { dry_run?: boolean; lead_ids?: number[] },
  ) {
    const caps = this.caps(req);
    const settings = await this.service.getPublishedPayload();
    return this.service.recalcHold(body, {
      isSuperAdmin: caps.isSuperAdmin,
      allowHoldRecalc: Boolean(settings.feature_flags.allow_hold_recalc),
    });
  }
}

@Controller('api/admin/staff')
@UseGuards(StaffOrInternalKeyGuard)
export class LeadSlaStaffAcceptsController {
  constructor(private readonly service: LeadSlaSettingsService) {}

  @Patch(':id/accepts-leads')
  @UseGuards(StaffLeadSlaEditGuard)
  patchAccepts(
    @Req() req: LeadSlaReq,
    @Param('id') id: string,
    @Body() body: { accepts_leads: boolean },
  ) {
    const caps = this.caps(req);
    return this.service.setAcceptsLeads(Number(id), Boolean(body.accepts_leads), {
      canEdit: caps.canEdit,
    });
  }

  private caps(req: LeadSlaReq): LeadSlaAccess {
    return (
      req.leadSlaAccess ?? {
        canView: false,
        canEdit: false,
        canPublish: false,
        isSuperAdmin: false,
      }
    );
  }
}
