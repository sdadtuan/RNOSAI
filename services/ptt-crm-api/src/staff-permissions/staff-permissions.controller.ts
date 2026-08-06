import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from './guards/staff-permissions.guard';
import { StaffPermissionsService } from './staff-permissions.service';
import type { PatchStaffPositionGrantsBody } from './staff-permissions.types';

@Controller('api/v1/staff/permissions')
export class StaffPermissionsController {
  constructor(private readonly permissions: StaffPermissionsService) {}

  @Get('catalog')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getCatalog() {
    return this.permissions.getCatalog();
  }

  @Get('positions')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listPositions() {
    return this.permissions.listPositions();
  }

  @Get('positions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getPosition(@Param('id') id: string) {
    return this.permissions.getPosition(Number(id));
  }

  @Get('positions/:id/export')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  exportPosition(@Param('id') id: string) {
    return this.permissions.exportPosition(Number(id));
  }

  @Patch('positions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  patchPosition(
    @Param('id') id: string,
    @Body() body: PatchStaffPositionGrantsBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    const actorEmail = staffUser?.email ?? '';
    return this.permissions.patchPosition(Number(id), body, actorEmail);
  }

  @Get('audit')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listAudit(@Query('position_id') positionId?: string, @Query('limit') limit?: string) {
    const pid = positionId != null && positionId !== '' ? Number(positionId) : undefined;
    const lim = limit != null && limit !== '' ? Number(limit) : undefined;
    return this.permissions.listAudit(pid, lim);
  }
}
