import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffOrgConfigureGuard,
  StaffOrgEffectiveCapsGuard,
  StaffOrgRosterViewGuard,
} from './guards/staff-org.guard';
import { StaffOrgService } from './staff-org.service';
import type { PutStaffUserJobFunctionsBody } from './staff-org.types';

@Controller('api/v1/staff/org')
export class StaffOrgController {
  constructor(private readonly org: StaffOrgService) {}

  @Get('job-functions/catalog')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  jobFunctionCatalog() {
    return { functions: this.org.listJobFunctionCatalog() };
  }

  @Get('users')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  listUsers() {
    return this.org.listUsers();
  }

  @Get('users/:id/job-functions')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgRosterViewGuard)
  getUserJobFunctions(@Param('id') id: string) {
    return this.org.getUserJobFunctions(id);
  }

  @Put('users/:id/job-functions')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgConfigureGuard)
  putUserJobFunctions(
    @Param('id') id: string,
    @Body() body: PutStaffUserJobFunctionsBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.org.putUserJobFunctions(id, body, staffUser?.email ?? '');
  }

  @Get('users/:id/effective-caps')
  @UseGuards(StaffOrInternalKeyGuard, StaffOrgEffectiveCapsGuard)
  getEffectiveCaps(@Param('id') id: string) {
    return this.org.getEffectiveCaps(id);
  }
}
