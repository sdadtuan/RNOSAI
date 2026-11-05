import { Body, Controller, Get, Headers, Param, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InternalKeyGuard } from '../auth/internal-key.guard';
import { PortalJwtGuard, PortalUser } from '../portal/portal-jwt.guard';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { applyAssetStreamHeaders } from '../cp/cp-asset-stream-file.util';
import { CreativesService } from './creatives.service';
import {
  CreateCreativeBody,
  CreateCreativeResponse,
  CreativeDecisionResponse,
  CreativeHistoryResponse,
  CreativePendingResponse,
  RejectCreativeBody,
} from './creatives.types';

@Controller('api/v1/creatives')
export class CreativesController {
  constructor(private readonly creatives: CreativesService) {}

  @Post()
  @UseGuards(InternalKeyGuard)
  async submit(@Body() body: CreateCreativeBody): Promise<CreateCreativeResponse> {
    return this.creatives.submit(body);
  }

  @Get('pending')
  @UseGuards(PortalJwtGuard)
  async listPending(@PortalUser() user: PortalJwtPayload): Promise<CreativePendingResponse> {
    return this.creatives.listPending(user.client_id);
  }

  @Get('history')
  @UseGuards(PortalJwtGuard)
  async listHistory(
    @PortalUser() user: PortalJwtPayload,
    @Query('days') days?: string,
  ): Promise<CreativeHistoryResponse> {
    return this.creatives.listHistory(user.client_id, Number(days) || 30);
  }

  @Get('pending/count')
  @UseGuards(PortalJwtGuard)
  async pendingCount(@PortalUser() user: PortalJwtPayload): Promise<{ ok: boolean; count: number }> {
    return this.creatives.pendingCount(user.client_id);
  }

  @Get(':id/asset-url')
  @UseGuards(PortalJwtGuard)
  async assetUrl(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
  ): Promise<{ url: string; mode: 'external' | 'signed'; mime: string }> {
    return this.creatives.mintAssetUrl(user, id.trim());
  }

  @Get(':id/asset')
  async asset(
    @Param('id') id: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const out = await this.creatives.openAssetStream(id.trim(), exp, sig, range);
    applyAssetStreamHeaders(res, out);
    return out.file;
  }

  @Post(':id/approve')
  @UseGuards(PortalJwtGuard)
  async approve(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
  ): Promise<CreativeDecisionResponse> {
    return this.creatives.approve(user, id.trim());
  }

  @Post(':id/reject')
  @UseGuards(PortalJwtGuard)
  async reject(
    @PortalUser() user: PortalJwtPayload,
    @Param('id') id: string,
    @Body() body: RejectCreativeBody,
  ): Promise<CreativeDecisionResponse> {
    return this.creatives.reject(user, id.trim(), body?.note);
  }
}
