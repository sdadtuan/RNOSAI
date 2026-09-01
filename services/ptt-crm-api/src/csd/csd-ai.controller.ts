import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdAiService } from './csd-ai.service';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd/ai')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdAiController {
  constructor(
    private readonly ai: CsdAiService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actorStaffId(req: AuthedReq): Promise<number> {
    if (!req.staffUser) return 0;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
  }

  @Post('conversations/:id/summarize')
  @RequireCsdAction('view')
  async summarize(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { period?: '24h' | '7d' | 'all' },
  ) {
    return this.ai.summarizeChat(await this.actorStaffId(req), id, body.period ?? '24h');
  }

  @Post('tickets/:id/classify')
  @RequireCsdAction('write')
  async classify(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.ai.classifyTicket(await this.actorStaffId(req), id);
  }

  @Post('tickets/:id/draft-reply')
  @RequireCsdAction('write')
  async draftReply(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.ai.draftReply(await this.actorStaffId(req), id);
  }
}
