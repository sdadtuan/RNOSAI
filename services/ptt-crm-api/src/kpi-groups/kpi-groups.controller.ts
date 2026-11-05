import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffKpiGroupsConfigureGuard,
  StaffKpiGroupsManageGuard,
  StaffKpiGroupsViewGuard,
} from './guards/staff-kpi-groups.guard';
import { KpiGroupsService } from './kpi-groups.service';
import type {
  ChangeKpiGroupStatusBody,
  CreateKpiGroupBody,
  DuplicateKpiGroupBody,
  ImportKpiGroupsBody,
  KpiGroupAuditQuery,
  KpiGroupListQuery,
  PatchKpiGroupBody,
  ReorderKpiGroupsBody,
} from './kpi-groups.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/kpi-groups')
@UseGuards(StaffOrInternalKeyGuard)
export class KpiGroupsController {
  constructor(
    private readonly groups: KpiGroupsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actor(req: AuthedReq) {
    if (req.staffAuthVia === 'internal') {
      return { staffId: 1, canConfigure: true };
    }
    if (!req.staffUser) {
      return { staffId: 0, canConfigure: false };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    const canConfigure = this.staffAuth.hasCap(me.caps, 'crm_kpi_groups', 'configure');
    return { staffId, canConfigure };
  }

  private parseRowVersion(header: string | undefined): number {
    const raw = String(header ?? '').trim();
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return 0;
    return n;
  }

  @Get()
  @UseGuards(StaffKpiGroupsViewGuard)
  list(@Query() query: KpiGroupListQuery) {
    return this.groups.list(query);
  }

  @Get('summary')
  @UseGuards(StaffKpiGroupsViewGuard)
  summary() {
    return this.groups.summary();
  }

  @Post()
  @UseGuards(StaffKpiGroupsManageGuard)
  async create(@Req() req: AuthedReq, @Body() body: CreateKpiGroupBody) {
    return this.groups.create(await this.actor(req), body);
  }

  @Put('display-order')
  @UseGuards(StaffKpiGroupsConfigureGuard)
  async reorder(@Req() req: AuthedReq, @Body() body: ReorderKpiGroupsBody) {
    return this.groups.reorder(await this.actor(req), body);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffKpiGroupsConfigureGuard)
  async importRows(@Req() req: AuthedReq, @Body() body: ImportKpiGroupsBody) {
    return this.groups.importRows(await this.actor(req), body);
  }

  @Get(':id')
  @UseGuards(StaffKpiGroupsViewGuard)
  get(@Param('id') id: string) {
    return this.groups.getById(id);
  }

  @Patch(':id')
  @UseGuards(StaffKpiGroupsManageGuard)
  async patch(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: PatchKpiGroupBody,
    @Headers('if-match') ifMatch?: string,
  ) {
    const rowVersion = this.parseRowVersion(ifMatch);
    return this.groups.update(await this.actor(req), id, body, rowVersion);
  }

  @Post(':id/status')
  @UseGuards(StaffKpiGroupsManageGuard)
  async changeStatus(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: ChangeKpiGroupStatusBody,
  ) {
    return this.groups.changeStatus(await this.actor(req), id, body);
  }

  @Post(':id/duplicate')
  @UseGuards(StaffKpiGroupsManageGuard)
  async duplicate(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: DuplicateKpiGroupBody,
  ) {
    return this.groups.duplicate(await this.actor(req), id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(StaffKpiGroupsManageGuard)
  async remove(@Req() req: AuthedReq, @Param('id') id: string) {
    await this.groups.delete(await this.actor(req), id);
  }

  @Get(':id/audit')
  @UseGuards(StaffKpiGroupsViewGuard)
  audit(@Param('id') id: string, @Query() query: KpiGroupAuditQuery) {
    return this.groups.listAudit(id, query);
  }
}
