import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { RequireMsosAction, StaffMsosGuard } from './guards/staff-msos.guard';
import { MsosService } from './msos.service';
import type { CreateInventoryInput, CreatePartnerInput, CreatePlacementInput } from './msos.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/media-os')
@UseGuards(StaffOrInternalKeyGuard, StaffMsosGuard)
export class MsosController {
  constructor(
    private readonly msos: MsosService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('health')
  @RequireMsosAction('view')
  health() {
    this.msos.assertEnabled();
    return this.msos.getHealth();
  }

  @Get('partners')
  @RequireMsosAction('view')
  listPartners() {
    return this.msos.listPartners();
  }

  @Post('partners')
  @RequireMsosAction('write')
  async createPartner(@Req() req: StaffReq, @Body() body: CreatePartnerInput) {
    const staffId = await this.resolveStaffId(req);
    return this.msos.createPartner({ ...body, staffId });
  }

  @Get('inventory')
  @RequireMsosAction('view')
  listInventory() {
    return this.msos.listInventories();
  }

  @Post('inventory')
  @RequireMsosAction('write')
  createInventory(@Body() body: CreateInventoryInput) {
    return this.msos.createInventory(body);
  }

  @Get('placements')
  @RequireMsosAction('view')
  listPlacements() {
    return this.msos.listPlacements();
  }

  @Post('placements')
  @RequireMsosAction('write')
  createPlacement(@Body() body: CreatePlacementInput) {
    return this.msos.createPlacement(body);
  }

  private async resolveStaffId(req: StaffReq): Promise<number | null> {
    if (req.staffAuthVia === 'internal') return null;
    if (!req.staffUser) return null;
    return (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? null;
  }
}
