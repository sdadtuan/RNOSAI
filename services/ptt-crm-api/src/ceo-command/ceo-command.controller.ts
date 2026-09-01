import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { parseNumericStaffSub } from '../staff-auth/staff-user-id.util';
import { CeoCommandActionsService } from './ceo-command-actions.service';
import { hasCeoConfigure } from './ceo-command-caps.util';
import { CeoCommandLearnService } from './ceo-command-learn.service';
import { CeoCommandService } from './ceo-command.service';
import type { CeoActor } from './ceo-command.types';
import {
  buildBoardPackFacts,
  isBoardPackNotifyEnabled,
  resolveBoardPackWeek,
} from './ceo-tower-board-pack.util';
import { CeoTowerSensorService } from './ceo-tower-sensor.service';
import type { TowerQuery } from './ceo-tower.types';
import {
  StaffCeoCommandJwtOnlyGuard,
  StaffCeoCommandViewGuard,
} from './guards/staff-ceo-command.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/ceo')
@UseGuards(StaffOrInternalKeyGuard, StaffCeoCommandViewGuard)
export class CeoCommandController {
  constructor(
    private readonly ceo: CeoCommandService,
    private readonly actions: CeoCommandActionsService,
    private readonly learn: CeoCommandLearnService,
    private readonly staffAuth: StaffAuthService,
    private readonly towerSensors: CeoTowerSensorService,
  ) {}

  private async actor(req: AuthedReq): Promise<CeoActor> {
    if (!req.staffUser) {
      return { staffId: 0, staffLabel: 'system', caps: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = parseNumericStaffSub(req.staffUser.sub) ?? 0;
    return {
      staffId,
      staffLabel: me.display_name || me.email || String(staffId),
      caps: me.caps,
    };
  }

  @Get('context')
  async context(@Req() req: AuthedReq) {
    const actor = await this.actor(req);
    return this.ceo.getContext(actor);
  }

  @Get('tower')
  async tower(@Req() req: AuthedReq, @Query() query: TowerQuery) {
    const actor = await this.actor(req);
    const severityTokens = String(query.severity ?? '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
    if (severityTokens.includes('ok') && !hasCeoConfigure(actor.caps)) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'ceo_command',
        action: 'configure',
      });
    }
    return this.towerSensors.buildPayload(actor, query);
  }

  @Get('tower/board-pack')
  async boardPack(@Req() req: AuthedReq, @Query('week') week?: string) {
    const actor = await this.actor(req);
    const weekLabel = resolveBoardPackWeek(week);
    const payload = await this.towerSensors.buildPayload(actor, {
      factory: 'both',
      severity: 'red,amber',
      limit: '10',
    });
    void isBoardPackNotifyEnabled();
    return {
      ok: true,
      week: weekLabel,
      facts_json: buildBoardPackFacts(payload, weekLabel),
      generated_at: payload.generated_at,
    };
  }

  @Get('threads')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async threads(@Req() req: AuthedReq, @Query('days') days?: string) {
    const actor = await this.actor(req);
    return this.ceo.listThreads(actor, Number(days) || 7);
  }

  @Get('turns')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async turns(@Req() req: AuthedReq, @Query('thread_id') threadId: string) {
    const actor = await this.actor(req);
    return this.ceo.listTurns(actor, threadId);
  }

  @Post('turns')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async postTurn(@Req() req: AuthedReq, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(req);
    return this.ceo.turn(
      {
        intent: String(body.intent ?? 'freeform'),
        message: body.message != null ? String(body.message) : undefined,
        intent_id: body.intent_id != null ? String(body.intent_id) : undefined,
        action_id: body.action_id != null ? String(body.action_id) : undefined,
        params: (body.params as Record<string, unknown>) ?? undefined,
        thread_id: body.thread_id != null ? String(body.thread_id) : undefined,
      },
      actor,
    );
  }

  @Post('actions/commit')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async commitAction(@Req() req: AuthedReq, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(req);
    return this.actions.commit(
      {
        turn_id: String(body.turn_id ?? ''),
        idempotency_key: String(body.idempotency_key ?? ''),
      },
      actor,
    );
  }

  @Patch('turns/:id/rating')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async rateTurn(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { rating?: string; reason?: string },
  ) {
    const actor = await this.actor(req);
    const rating = body.rating === 'down' ? 'down' : 'up';
    return this.ceo.rateTurn(id, rating, body.reason, actor);
  }

  @Get('learn/candidates')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async learnCandidates(@Req() req: AuthedReq, @Query('status') status?: string) {
    const actor = await this.actor(req);
    return this.learn.listCandidates(status, actor);
  }

  @Get('learn/down-turns')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async learnDown(@Req() req: AuthedReq, @Query('days') days?: string) {
    const actor = await this.actor(req);
    return this.learn.listDownTurns(Number(days) || 30, actor);
  }

  @Post('learn/propose/:turnId')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async learnPropose(@Req() req: AuthedReq, @Param('turnId') turnId: string) {
    const actor = await this.actor(req);
    return this.learn.proposeFromTurn(turnId, actor);
  }

  @Post('learn/candidates/:id/approve')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async learnApprove(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.actor(req);
    return this.learn.approveCandidate(id, body, actor);
  }

  @Post('learn/candidates/:id/reject')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async learnReject(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const actor = await this.actor(req);
    return this.learn.rejectCandidate(id, String(body.reason ?? ''), actor);
  }

  @Get('learn/export')
  @UseGuards(StaffCeoCommandJwtOnlyGuard)
  async learnExport(@Req() req: AuthedReq) {
    const actor = await this.actor(req);
    return this.learn.exportJsonl(actor);
  }

}
