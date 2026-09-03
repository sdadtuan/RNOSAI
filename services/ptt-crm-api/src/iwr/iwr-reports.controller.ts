import {
  Body,
  Controller,
  Delete,
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
import { IwrItemsService } from './iwr-items.service';
import { IwrDistributionService } from './iwr-distribution.service';
import { IwrOrgRepository } from './iwr-reports.repository';
import { IwrReportsService } from './iwr-reports.service';
import { IwrSuggestService } from './iwr-suggest.service';
import type {
  AddIwrCommentInput,
  CreateIwrReportInput,
  IwrActor,
  IwrItemRow,
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
    private readonly items: IwrItemsService,
    private readonly suggest: IwrSuggestService,
    private readonly distribution: IwrDistributionService,
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

  @Post('backfill')
  @RequireIwrAction('write')
  async backfill(@Req() req: AuthedReq, @Body() body: { ymd: string }) {
    return this.reports.createBackfill(await this.actor(req), body);
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

  @Get(':id/export.xlsx')
  @RequireIwrAction('export')
  async exportXlsx(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const buf = await this.reports.exportXlsx(await this.actor(req), id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="iwr-${id}.xlsx"`);
    res.send(buf);
  }

  @Get(':id/export.csv')
  @RequireIwrAction('export')
  async exportCsv(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const csv = await this.reports.exportCsv(await this.actor(req), id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="iwr-${id}.csv"`);
    res.send(csv);
  }

  @Get(':id/items')
  @RequireIwrAction('view')
  async listItems(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.items.list(await this.actor(req), id);
  }

  @Post(':id/items')
  @RequireIwrAction('write')
  async addItem(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: Omit<IwrItemRow, 'id' | 'report_id'>,
  ) {
    return this.items.add(await this.actor(req), id, body);
  }

  @Patch(':id/items/:itemId')
  @RequireIwrAction('write')
  async patchItem(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: Partial<IwrItemRow>,
  ) {
    return this.items.patch(await this.actor(req), id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  @RequireIwrAction('write')
  async removeItem(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.items.remove(await this.actor(req), id, itemId);
  }

  @Get(':id/suggest')
  @RequireIwrAction('view')
  async suggestForReport(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.suggest.suggestForReport(await this.actor(req), id);
  }

  @Get(':id/sources')
  @RequireIwrAction('view')
  async listSources(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.reports.listEligibleSources(await this.actor(req), id);
  }

  @Post(':id/sources')
  @RequireIwrAction('write')
  async applySources(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { source_report_ids?: string[] },
  ) {
    return this.reports.applySources(await this.actor(req), id, body.source_report_ids ?? []);
  }

  @Post(':id/viewed')
  @RequireIwrAction('view')
  async markViewed(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.reports.markViewed(await this.actor(req), id);
  }

  @Get(':id/delivery-logs')
  @RequireIwrAction('view')
  async deliveryLogs(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.distribution.listDeliveryLogs(await this.actor(req), id);
  }

  @Post(':id/reply')
  @RequireIwrAction('view')
  async reply(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { body_text: string; mention_staff_ids?: number[] },
  ) {
    return this.distribution.reply(await this.actor(req), id, body);
  }

  @Post(':id/reply-all')
  @RequireIwrAction('view')
  async replyAll(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { body_text: string },
  ) {
    return this.distribution.replyAll(await this.actor(req), id, body);
  }

  @Post(':id/forward')
  @RequireIwrAction('view')
  async forward(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { to_staff_ids: number[]; note: string },
  ) {
    return this.distribution.forward(await this.actor(req), id, body);
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
