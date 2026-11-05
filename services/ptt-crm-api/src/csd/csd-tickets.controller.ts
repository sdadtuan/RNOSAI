import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdTicketsService } from './csd-tickets.service';
import type { CreateCsdTicketInput, CsdTicketListQuery, CsdTicketStatus } from './csd.types';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd/tickets')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdTicketsController {
  constructor(
    private readonly tickets: CsdTicketsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actorStaffId(req: AuthedReq): Promise<number> {
    if (!req.staffUser) return 0;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
  }

  @Post()
  @RequireCsdAction('write')
  async create(@Req() req: AuthedReq, @Body() body: CreateCsdTicketInput) {
    return this.tickets.create(await this.actorStaffId(req), body);
  }

  @Get()
  @RequireCsdAction('view')
  async list(
    @Req() req: AuthedReq,
    @Query('status') status?: CsdTicketStatus,
    @Query('priority') priority?: CsdTicketListQuery['priority'],
    @Query('assignee_staff_id') assigneeStaffId?: string,
    @Query('client_account_id') clientAccountId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const sid = assigneeStaffId ? Number(assigneeStaffId) : undefined;
    return this.tickets.list(await this.actorStaffId(req), {
      status,
      priority,
      assignee_staff_id: sid && Number.isFinite(sid) ? sid : undefined,
      client_account_id: clientAccountId,
      q,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Get(':id')
  @RequireCsdAction('view')
  async get(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.tickets.get(await this.actorStaffId(req), id);
  }

  @Post(':id/assign')
  @RequireCsdAction('assign')
  async assign(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: { assignee_staff_id: number }) {
    return this.tickets.assign(await this.actorStaffId(req), id, Number(body.assignee_staff_id));
  }

  @Post(':id/status')
  @RequireCsdAction('write')
  async changeStatus(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: { status: CsdTicketStatus }) {
    return this.tickets.changeStatus(await this.actorStaffId(req), id, body.status);
  }

  @Post(':id/comments')
  @RequireCsdAction('write')
  async addComment(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body()
    body: { visibility: 'public' | 'internal'; body_text: string; attachment_ids?: string[] },
  ) {
    return this.tickets.addComment(await this.actorStaffId(req), id, body);
  }

  @Post(':id/resolve')
  @RequireCsdAction('write')
  async resolve(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { resolution_note: string; send_public?: boolean },
  ) {
    return this.tickets.resolve(await this.actorStaffId(req), id, body);
  }

  @Get(':id/activities')
  @RequireCsdAction('view')
  async listActivities(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.tickets.listActivities(await this.actorStaffId(req), id);
  }

  @Get(':id/comments')
  @RequireCsdAction('view')
  async listComments(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.tickets.listComments(await this.actorStaffId(req), id);
  }
}
