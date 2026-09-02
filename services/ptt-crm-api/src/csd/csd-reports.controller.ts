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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CsdReportsService } from './csd-reports.service';
import type {
  CsdActor,
  CsdReportListQuery,
  CreateCsdReportInput,
  CreateCsdReportScheduleInput,
  SendCsdReportInput,
  SnapshotCsdReportInput,
  TransitionCsdReportInput,
} from './csd.types';
import { RequireCsdAction, StaffCsdGuard } from './guards/staff-csd.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/csd/reports')
@UseGuards(StaffOrInternalKeyGuard, StaffCsdGuard)
export class CsdReportsController {
  constructor(
    private readonly reports: CsdReportsService,
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

  @Post()
  @RequireCsdAction('write')
  async create(@Req() req: AuthedReq, @Body() body: CreateCsdReportInput) {
    const actor = await this.actor(req);
    return this.reports.createReport(actor, body);
  }

  @Post('schedules')
  @RequireCsdAction('manage')
  async createSchedule(@Req() req: AuthedReq, @Body() body: CreateCsdReportScheduleInput) {
    const actor = await this.actor(req);
    return this.reports.createSchedule(actor, body);
  }

  @Get('schedules')
  @RequireCsdAction('view')
  async listSchedules(@Req() req: AuthedReq) {
    const actor = await this.actor(req);
    return this.reports.listSchedules(actor);
  }

  @Get()
  @RequireCsdAction('view')
  async list(
    @Req() req: AuthedReq,
    @Query('status') status?: CsdReportListQuery['status'],
    @Query('template_code') templateCode?: string,
    @Query('client_account_id') clientAccountId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const actor = await this.actor(req);
    const parsedLimit = limit != null ? Number(limit) : undefined;
    return this.reports.list(actor, {
      status,
      template_code: templateCode,
      client_account_id: clientAccountId,
      q,
      limit: parsedLimit != null && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get(':id')
  @RequireCsdAction('view')
  async get(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.reports.getDetail(actor, id);
  }

  @Get(':id/export.pdf')
  @RequireCsdAction('view')
  async exportPdf(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const actor = await this.actor(req);
    const out = await this.reports.exportPdf(actor, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.buffer);
  }

  @Get(':id/export.xlsx')
  @RequireCsdAction('view')
  async exportXlsx(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const actor = await this.actor(req);
    const out = await this.reports.exportXlsx(actor, id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.buffer);
  }

  @Post(':id/submit-review')
  @RequireCsdAction('write')
  async submitReview(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { approver_staff_id?: number },
  ) {
    const actor = await this.actor(req);
    return this.reports.submitReview(actor, id, body.approver_staff_id);
  }

  @Post(':id/approve')
  @RequireCsdAction('manage')
  async approve(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.reports.approve(actor, id);
  }

  @Post(':id/transition')
  @RequireCsdAction('write')
  async transition(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: TransitionCsdReportInput,
  ) {
    const actor = await this.actor(req);
    return this.reports.transition(actor, id, body);
  }

  @Post(':id/request-changes')
  @RequireCsdAction('manage')
  async requestChanges(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { comment?: string },
  ) {
    const actor = await this.actor(req);
    return this.reports.transition(actor, id, { to: 'changes_requested', comment: body.comment });
  }

  @Post(':id/send')
  @RequireCsdAction('write')
  async send(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: SendCsdReportInput,
  ) {
    const actor = await this.actor(req);
    return this.reports.send(actor, id, body);
  }

  @Post(':id/share-chat')
  @RequireCsdAction('write')
  async shareChat(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { conversation_id: string },
  ) {
    const actor = await this.actor(req);
    return this.reports.shareToClientChat(actor, id, body);
  }

  @Post(':id/retry-send')
  @RequireCsdAction('write')
  async retrySend(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.reports.retrySend(actor, id);
  }

  @Patch(':id/sections')
  @RequireCsdAction('write')
  async updateSections(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { sections_json: Record<string, unknown> },
  ) {
    const actor = await this.actor(req);
    return this.reports.updateSections(actor, id, body.sections_json ?? {});
  }

  @Post(':id/revise')
  @RequireCsdAction('write')
  async revise(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.reports.createRevisedVersion(actor, id);
  }

  @Post(':id/versions')
  @RequireCsdAction('write')
  async snapshotVersion(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: SnapshotCsdReportInput,
  ) {
    const actor = await this.actor(req);
    return this.reports.snapshotVersion(actor, id, body);
  }

  @Post(':id/rollup')
  @RequireCsdAction('write')
  async rollup(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.actor(req);
    return this.reports.rollupTickets(actor, id);
  }

  @Post(':id/files')
  @RequireCsdAction('write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 104857600 },
    }),
  )
  async uploadFile(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const actor = await this.actor(req);
    return this.reports.uploadFile(actor, id, file);
  }
}
