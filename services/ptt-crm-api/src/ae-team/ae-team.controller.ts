import { BadRequestException, Body, Controller, Get, Header, HttpCode, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ManualSplitChoice } from '../b2b-projects/b2b-manual-reassign.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AeTeamAlertsService } from './ae-team-alerts.service';
import { AeTeamService } from './ae-team.service';

@Controller('api/crm/ae-team')
@UseGuards(StaffOrInternalKeyGuard)
export class AeTeamController {
  constructor(
    private readonly team: AeTeamService,
    private readonly alerts: AeTeamAlertsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('summary')
  async summary(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const actor = this.actor(req);
    return { ok: true, data: await this.team.summary(actor, { preset, from, to }) };
  }

  @Get('ranking/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async rankingExport(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Res() res: Response,
    @Query('grain') grain?: string,
    @Query('format') format?: string,
  ) {
    if (format !== 'csv') {
      throw new BadRequestException({ ok: false, error: { code: 'format_unsupported', message: 'Chỉ xuất CSV.' } });
    }
    const csv = await this.team.rankingCsv(this.actor(req), grain);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="xep-hang-doi-ae.csv"');
    res.send(csv);
  }

  @Get('ranking')
  async ranking(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Query('grain') grain?: string,
  ) {
    return { ok: true, data: await this.team.ranking(this.actor(req), grain) };
  }

  @Get('me/rank')
  async myRank(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Query('grain') grain?: string,
  ) {
    return { ok: true, data: await this.team.meRank(this.actor(req), grain) };
  }

  @Get('interventions')
  async interventions(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return { ok: true, data: await this.team.interventions(this.actor(req)) };
  }

  @Post('interventions/remind')
  @HttpCode(200)
  async remind(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: { lead_ids?: number[]; note?: string },
  ) {
    return { ok: true, data: await this.team.remind(this.actor(req), body ?? {}) };
  }

  @Post('reassign')
  @HttpCode(200)
  async reassign(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: { lead_ids?: number[]; to_staff_id?: number; reason?: string; split?: ManualSplitChoice },
  ) {
    return { ok: true, data: await this.team.reassign(this.actor(req), body ?? {}) };
  }

  @Post('instructions')
  @HttpCode(200)
  async instruct(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: { lead_id?: number; note?: string },
  ) {
    return { ok: true, data: await this.team.instruct(this.actor(req), body ?? {}) };
  }

  @Post('instructions/:id/read')
  @HttpCode(200)
  async readInstruction(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { ok: true, data: await this.team.markInstructionRead(this.actor(req), id) };
  }

  @Post('intake')
  @HttpCode(200)
  async intake(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: { staff_id?: number; accepting?: boolean; note?: string },
  ) {
    return { ok: true, data: await this.team.setIntake(this.actor(req), body ?? {}) };
  }

  @Get('suggest')
  async suggest(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Query('lead_id', ParseIntPipe) leadId: number,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return { ok: true, data: await this.team.suggest(this.actor(req), leadId, { preset, from, to }) };
  }

  @Get('alerts')
  async alertsList(@Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }) {
    return { ok: true, data: await this.alerts.list(this.actor(req)) };
  }

  @Post('alerts/tick')
  @HttpCode(200)
  async tickAlerts(@Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }) {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return { ok: true, data: await this.alerts.tick(new Date(), undefined, true) };
    }
    return { ok: true, data: await this.alerts.tick(new Date(), this.actor(req), true) };
  }

  @Post('alerts/:id/ack')
  @HttpCode(200)
  async ackAlert(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { ok: true, data: await this.alerts.acknowledge(this.actor(req), id) };
  }

  @Post('alerts/:id/resolve')
  @HttpCode(200)
  async resolveAlert(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { ok: true, data: await this.alerts.resolve(this.actor(req), id) };
  }

  @Get('members/:staffId')
  async member(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('staffId', ParseIntPipe) staffId: number,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const actor = this.actor(req);
    return { ok: true, data: await this.team.member(actor, staffId, { preset, from, to }) };
  }

  @Get('members/:staffId/leads')
  async leads(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    const actor = this.actor(req);
    const viewer = await this.staffAuth.resolveCrmStaffUserId(actor);
    return { ok: true, data: await this.team.leads(actor, staffId, viewer) };
  }

  private actor(req: Request & { staffUser?: StaffJwtPayload }): StaffJwtPayload {
    if (!req.staffUser?.sub) {
      throw new Error('staff_required');
    }
    return req.staffUser;
  }
}
