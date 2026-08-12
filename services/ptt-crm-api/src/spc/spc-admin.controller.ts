import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffSpcEditGuard,
  StaffSpcPublishGuard,
  StaffSpcViewGuard,
} from './guards/staff-spc.guard';
import { SpcService } from './spc.service';
import type { SpcPatchOfferBody, SpcPublishBody, SpcPutProcessPhaseBody } from './spc.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/v1/admin/spc')
@UseGuards(StaffOrInternalKeyGuard, StaffSpcViewGuard)
export class SpcAdminController {
  constructor(private readonly spc: SpcService) {}

  @Get('hub')
  getHub() {
    return this.spc.getHubStats();
  }

  @Get('families')
  listFamilies() {
    return this.spc.getPortfolio(false);
  }

  @Get('families/:dvCode')
  getFamily(@Param('dvCode') dvCode: string) {
    return this.spc.getFamily(dvCode, false);
  }

  @Get('offers/:skuCode')
  getOffer(@Param('skuCode') skuCode: string) {
    return this.spc.getOffer(skuCode, false);
  }

  @Patch('offers/:skuCode')
  @UseGuards(StaffSpcEditGuard)
  patchOffer(@Param('skuCode') skuCode: string, @Body() body: SpcPatchOfferBody) {
    return this.spc.patchOffer(skuCode, body);
  }

  @Post('publish')
  @UseGuards(StaffSpcPublishGuard)
  publish(@Body() body: SpcPublishBody, @Req() req: StaffReq) {
    const actor = req.staffUser?.email ?? req.staffAuthVia ?? 'staff';
    return this.spc.publish(body, String(actor));
  }

  @Get('publish-log')
  publishLog(@Query('limit') limit?: string) {
    return this.spc.getPublishLog(limit ? Number(limit) : undefined);
  }

  @Get('process')
  listProcess(@Query('dv_code') dvCode?: string) {
    return this.spc.listProcessLibrary(dvCode);
  }

  @Put('process/:phaseCode')
  @UseGuards(StaffSpcEditGuard)
  putProcess(@Param('phaseCode') phaseCode: string, @Body() body: SpcPutProcessPhaseBody) {
    return this.spc.putProcessPhase(phaseCode, body);
  }
}
