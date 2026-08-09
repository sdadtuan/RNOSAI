import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffOpsViewGuard } from './guards/staff-ops-view.guard';
import { OpsService } from './ops.service';

@Controller('api/ops')
@UseGuards(StaffOrInternalKeyGuard, StaffOpsViewGuard)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('health')
  health() {
    return this.ops.health();
  }

  @Get('catalog')
  getCatalog() {
    return this.ops.getCatalog();
  }

  @Get('catalog/:dvCode')
  getCatalogByCode(@Param('dvCode') dvCode: string) {
    return this.ops.getCatalogByCode(dvCode);
  }

  @Get('lifecycle/:lifecycleId/hub')
  getHub(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.ops.getHub(lifecycleId);
  }
}
