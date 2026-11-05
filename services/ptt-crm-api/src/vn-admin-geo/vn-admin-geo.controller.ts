import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from '../crm-config/guards/staff-crm-config.guard';
import { VnAdminGeoService } from './vn-admin-geo.service';
import type {
  CreateVnProvinceBody,
  CreateVnWardBody,
  PatchVnProvinceBody,
  PatchVnWardBody,
} from './vn-admin-geo.types';

@Controller('api/v1/geo')
export class VnAdminGeoController {
  constructor(private readonly geo: VnAdminGeoService) {}

  /** Read-only for any authenticated staff (address forms). */
  @Get('provinces')
  @UseGuards(StaffOrInternalKeyGuard)
  listProvinces(@Query('include_inactive') includeInactive?: string) {
    const include = includeInactive === '1' || includeInactive === 'true';
    return this.geo.listProvinces(include);
  }

  @Get('wards')
  @UseGuards(StaffOrInternalKeyGuard)
  listWards(
    @Query('province_code') provinceCode?: string,
    @Query('include_inactive') includeInactive?: string,
  ) {
    const include = includeInactive === '1' || includeInactive === 'true';
    return this.geo.listWards(provinceCode, include);
  }

  @Get('admin/provinces')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  adminListProvinces(@Query('include_inactive') includeInactive?: string) {
    const include = includeInactive === '1' || includeInactive === 'true' || includeInactive === 'yes';
    return this.geo.listProvinces(include);
  }

  @Post('admin/provinces')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createProvince(@Body() body: CreateVnProvinceBody) {
    return this.geo.createProvince(body);
  }

  @Patch('admin/provinces/:code')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  patchProvince(@Param('code') code: string, @Body() body: PatchVnProvinceBody) {
    return this.geo.patchProvince(code, body);
  }

  @Delete('admin/provinces/:code')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteProvince(@Param('code') code: string) {
    return this.geo.deleteProvince(code);
  }

  @Get('admin/wards')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  adminListWards(
    @Query('province_code') provinceCode?: string,
    @Query('include_inactive') includeInactive?: string,
  ) {
    const include = includeInactive === '1' || includeInactive === 'true' || includeInactive === 'yes';
    return this.geo.listWards(provinceCode, include);
  }

  @Post('admin/wards')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createWard(@Body() body: CreateVnWardBody) {
    return this.geo.createWard(body);
  }

  @Patch('admin/wards/:code')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  patchWard(@Param('code') code: string, @Body() body: PatchVnWardBody) {
    return this.geo.patchWard(code, body);
  }

  @Delete('admin/wards/:code')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteWard(@Param('code') code: string) {
    return this.geo.deleteWard(code);
  }

  @Post('admin/sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  syncNational() {
    return this.geo.syncFromNationalSource();
  }
}
