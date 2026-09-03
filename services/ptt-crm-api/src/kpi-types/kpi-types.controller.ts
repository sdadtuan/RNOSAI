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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffKpiTypesConfigureGuard,
  StaffKpiTypesManageGuard,
  StaffKpiTypesViewGuard,
} from './guards/staff-kpi-types.guard';
import { KpiTypesService } from './kpi-types.service';
import type {
  ChangeKpiTypeStatusBody,
  CreateKpiTypeBody,
  DuplicateKpiTypeBody,
  KpiTypeAuditQuery,
  KpiTypeListQuery,
  PatchKpiTypeBody,
  ValidateKpiTypeFormulaBody,
} from './kpi-types.types';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/kpi-types')
@UseGuards(StaffOrInternalKeyGuard)
export class KpiTypesController {
  constructor(
    private readonly types: KpiTypesService,
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
    const canConfigure = this.staffAuth.hasCap(me.caps, 'crm_kpi_types', 'configure');
    return { staffId, canConfigure };
  }

  private parseRowVersion(header: string | undefined): number {
    const raw = String(header ?? '').trim();
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return 0;
    return n;
  }

  @Get()
  @UseGuards(StaffKpiTypesViewGuard)
  list(@Query() query: KpiTypeListQuery) {
    return this.types.list(query);
  }

  @Get('summary')
  @UseGuards(StaffKpiTypesViewGuard)
  summary() {
    return this.types.summary();
  }

  @Get('units')
  @UseGuards(StaffKpiTypesViewGuard)
  units() {
    return this.types.listUnits();
  }

  @Get('data-sources')
  @UseGuards(StaffKpiTypesViewGuard)
  dataSources() {
    return this.types.listDataSources();
  }

  @Post()
  @UseGuards(StaffKpiTypesManageGuard)
  async create(@Req() req: AuthedReq, @Body() body: CreateKpiTypeBody) {
    return this.types.create(await this.actor(req), body);
  }

  @Get(':id')
  @UseGuards(StaffKpiTypesViewGuard)
  get(@Param('id') id: string) {
    return this.types.getById(id);
  }

  @Patch(':id')
  @UseGuards(StaffKpiTypesManageGuard)
  async patch(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: PatchKpiTypeBody,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.types.update(await this.actor(req), id, body, this.parseRowVersion(ifMatch));
  }

  @Post(':id/status')
  @UseGuards(StaffKpiTypesManageGuard)
  async changeStatus(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: ChangeKpiTypeStatusBody,
  ) {
    return this.types.changeStatus(await this.actor(req), id, body);
  }

  @Post(':id/duplicate')
  @UseGuards(StaffKpiTypesManageGuard)
  async duplicate(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: DuplicateKpiTypeBody,
  ) {
    return this.types.duplicate(await this.actor(req), id, body);
  }

  @Post(':id/validate-formula')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffKpiTypesConfigureGuard)
  async validateFormula(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: ValidateKpiTypeFormulaBody,
  ) {
    return this.types.validateFormula(await this.actor(req), id, body);
  }

  @Get(':id/versions')
  @UseGuards(StaffKpiTypesViewGuard)
  versions(@Param('id') id: string) {
    return this.types.listVersions(id);
  }

  @Get(':id/audit')
  @UseGuards(StaffKpiTypesViewGuard)
  audit(@Param('id') id: string, @Query() query: KpiTypeAuditQuery) {
    return this.types.listAudit(id, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(StaffKpiTypesManageGuard)
  async remove(@Req() req: AuthedReq, @Param('id') id: string) {
    await this.types.delete(await this.actor(req), id);
  }
}
