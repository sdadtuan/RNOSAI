import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { P13CatalogManageGuard, P13CatalogViewGuard } from '../p13-caps.guard';
import { P13EnabledGuard } from '../p13-enabled.guard';
import { P13CatalogService } from './catalog.service';
import type { ItemPatchBody } from './catalog-item-patch';

type StaffRequest = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

function actorOf(req: StaffRequest): string {
  return req.staffUser?.email || req.staffUser?.sub || 'internal';
}

@Controller('api/crm/p13')
@UseGuards(P13EnabledGuard, StaffOrInternalKeyGuard)
export class P13CatalogController {
  constructor(private readonly catalog: P13CatalogService) {}

  @Get('groups')
  @UseGuards(P13CatalogViewGuard)
  groups() {
    return this.catalog.listGroups();
  }

  @Get('services')
  @UseGuards(P13CatalogViewGuard)
  services() {
    return this.catalog.listServices();
  }

  @Get('services/:code')
  @UseGuards(P13CatalogViewGuard)
  service(@Param('code') code: string) {
    return this.catalog.getService(code.toUpperCase());
  }

  @Patch('service-items/:code')
  @UseGuards(P13CatalogManageGuard)
  patchItem(@Param('code') code: string, @Body() body: ItemPatchBody, @Req() req: StaffRequest) {
    return this.catalog.patchItem(code.toUpperCase(), body, actorOf(req));
  }

  @Post('services/:code/confirm-hours')
  @UseGuards(P13CatalogManageGuard)
  confirmHours(@Param('code') code: string, @Req() req: StaffRequest) {
    return this.catalog.confirmServiceHours(code.toUpperCase(), actorOf(req));
  }

  @Post('catalog-import')
  @UseGuards(P13CatalogManageGuard)
  importSeed(
    @Body() body: { seed?: unknown; dry_run?: boolean; force_hours?: boolean; deactivate_missing?: boolean; file_name?: string },
    @Req() req: StaffRequest,
  ) {
    return this.catalog.importPayload(body.seed, {
      dryRun: body.dry_run === true,
      forceHours: body.force_hours === true,
      deactivateMissing: body.deactivate_missing === true,
      fileName: body.file_name || 'upload.json',
      actor: actorOf(req),
    });
  }

  @Get('imports')
  @UseGuards(P13CatalogViewGuard)
  imports() {
    return this.catalog.listImports();
  }
}
