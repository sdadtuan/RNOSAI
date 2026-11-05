import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdEmailService } from './csd-email.service';
import type { CsdActor, SendCsdEmailInput } from './csd.types';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd/emails')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdEmailController {
  constructor(
    private readonly email: CsdEmailService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actor(req: AuthedReq): Promise<CsdActor> {
    if (!req.staffUser) {
      return { staffId: 0, staffLabel: 'system', caps: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    return {
      staffId,
      staffLabel: me.display_name || me.email || String(staffId),
      caps: me.caps,
    };
  }

  @Get('unmatched')
  @RequireCsdAction('view')
  async listUnmatched(@Req() req: AuthedReq, @Query('limit') limit?: string) {
    const actor = await this.actor(req);
    return this.email.listUnmatched(actor, limit ? Number(limit) : undefined);
  }

  @Post('send')
  @RequireCsdAction('write')
  async send(@Req() req: AuthedReq, @Body() body: SendCsdEmailInput) {
    const actor = await this.actor(req);
    return this.email.send(actor, body);
  }
}
