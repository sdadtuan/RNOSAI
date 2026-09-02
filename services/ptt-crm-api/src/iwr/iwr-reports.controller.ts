import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireIwrAction, StaffIwrGuard } from './guards/staff-iwr.guard';
import { IwrOrgRepository } from './iwr-reports.repository';
import { IwrReportsService } from './iwr-reports.service';
import type {
  AddIwrCommentInput,
  CreateIwrReportInput,
  IwrActor,
  PatchIwrReportInput,
  RequestIwrChangesInput,
  SubmitIwrReportInput,
  WaiveIwrReportInput,
} from './iwr.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/iwr/reports')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
export class IwrReportsController {
  constructor(
    private readonly reports: IwrReportsService,
    private readonly staffAuth: StaffAuthService,
    private readonly org: IwrOrgRepository,
  ) {}

  private async actor(req: AuthedReq): Promise<IwrActor> {
    if (!req.staffUser) {
      return { staffId: 0, staffLabel: 'system', departmentId: null, caps: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    const self = staffId > 0 ? await this.org.getStaff(staffId) : null;
    return {
      staffId,
      staffLabel: me.display_name || me.email || String(staffId),
      departmentId: self?.department_id ?? null,
      caps: me.caps,
    };
  }

  @Post()
  @RequireIwrAction('write')
  async create(@Req() req: AuthedReq, @Body() body: CreateIwrReportInput) {
    return this.reports.create(await this.actor(req), body);
  }

  @Get()
  @RequireIwrAction('view')
  async list(
    @Req() req: AuthedReq,
    @Query('status') status?: string,
    @Query('template_code') template_code?: string,
  ) {
    return this.reports.listMine(await this.actor(req), { status, template_code });
  }

  @Get(':id/export.pdf')
  @RequireIwrAction('view')
  async exportPdf(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const buf = await this.reports.exportPdf(await this.actor(req), id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="iwr-${id}.pdf"`);
    res.send(buf);
  }

  @Get(':id/comments')
  @RequireIwrAction('view')
  async listComments(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('section_key') sectionKey?: string,
  ) {
    return this.reports.listComments(await this.actor(req), id, sectionKey);
  }

  @Get(':id')
  @RequireIwrAction('view')
  async get(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.reports.get(await this.actor(req), id);
  }

  @Patch(':id')
  @RequireIwrAction('write')
  async patch(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: PatchIwrReportInput) {
    return this.reports.patch(await this.actor(req), id, body);
  }

  @Post(':id/submit')
  @RequireIwrAction('write')
  async submit(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: SubmitIwrReportInput) {
    return this.reports.submit(await this.actor(req), id, body);
  }

  @Post(':id/withdraw')
  @RequireIwrAction('write')
  async withdraw(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.reports.withdraw(await this.actor(req), id);
  }

  @Post(':id/acknowledge')
  @RequireIwrAction('review')
  async acknowledge(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.reports.acknowledge(await this.actor(req), id);
  }

  @Post(':id/request-changes')
  @RequireIwrAction('review')
  async requestChanges(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: RequestIwrChangesInput,
  ) {
    return this.reports.requestChanges(await this.actor(req), id, body);
  }

  @Post(':id/waive')
  @RequireIwrAction('manage')
  async waive(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: WaiveIwrReportInput) {
    return this.reports.waive(await this.actor(req), id, body);
  }

  @Post(':id/comments')
  @RequireIwrAction('view')
  async addComment(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: AddIwrCommentInput) {
    return this.reports.addComment(await this.actor(req), id, body);
  }
}
