import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtGuard } from '../../staff-auth/staff-jwt.guard';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { OpsKpiTargetWriteService } from './ops-kpi-target-write.service';
import { OpsRoleKpiRepository } from './ops-role-kpi.repository';
import { isRoleKpiStatus, RoleKpiStatus } from './ops-kpi-target.types';

type ReqWithStaff = Request & { staffUser?: StaffJwtPayload };

@Controller('api/crm/kpi-hub/role-kpi')
@UseGuards(StaffJwtGuard)
export class RoleKpiController {
  constructor(
    private readonly repo: OpsRoleKpiRepository,
    private readonly write: OpsKpiTargetWriteService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get()
  async list(
    @Req() req: ReqWithStaff,
    @Query('plan_id') planId?: string,
    @Query('lifecycle_id') lifecycleId?: string,
    @Query('role_key') roleKey?: string,
    @Query('status') status?: string,
  ) {
    await this.assertView(req);
    const rows = await this.repo.list({
      plan_id: planId ? Number(planId) : undefined,
      lifecycle_id: lifecycleId ? Number(lifecycleId) : undefined,
      role_key: roleKey || undefined,
      status: status || undefined,
      limit: 200,
    });
    return { ok: true, data: rows, total: rows.length };
  }

  @Get('summary')
  async summary(@Req() req: ReqWithStaff, @Query('plan_id') planId?: string) {
    await this.assertView(req);
    const id = Number(planId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException({ error: 'plan_id_required' });
    }
    const reviewCount = await this.repo.countByPlanAndStatus(id, 'review');
    const draftCount = await this.repo.countByPlanAndStatus(id, 'draft');
    return {
      ok: true,
      plan_id: id,
      review_count: reviewCount,
      draft_count: draftCount,
      link: `/crm/kpi-hub/role-kpi?plan_id=${id}&status=review`,
    };
  }

  @Get(':id')
  async getOne(@Req() req: ReqWithStaff, @Param('id', ParseIntPipe) id: number) {
    await this.assertView(req);
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: 'kpi_not_found', id });
    return { ok: true, data: row };
  }

  @Patch(':id/status')
  async patchStatus(
    @Req() req: ReqWithStaff,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string },
  ) {
    const to = String(body?.status ?? '')
      .trim()
      .toLowerCase();
    if (!isRoleKpiStatus(to)) {
      throw new BadRequestException({ error: 'period_invalid', status: to });
    }
    if (to === 'review' || to === 'cancelled') {
      await this.assertManage(req);
    } else if (to === 'approved') {
      await this.assertApprove(req);
    } else {
      throw new BadRequestException({ error: 'kpi_not_editable', status: to });
    }
    const me = await this.staffAuth.me(req.staffUser!);
    const actor = String(me.email ?? me.id ?? 'staff');
    const row = await this.write.transitionStatus(id, to as RoleKpiStatus, actor);
    return { ok: true, data: row };
  }

  private async assertView(req: ReqWithStaff): Promise<void> {
    if (!req.staffUser) throw new ForbiddenException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      !this.staffAuth.hasCap(me.caps, 'crm_kpi_hub', 'view') &&
      !this.staffAuth.hasCap(me.caps, 'crm_kpi_hub_targets', 'view')
    ) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_kpi_hub' });
    }
  }

  private async assertManage(req: ReqWithStaff): Promise<void> {
    if (!req.staffUser) throw new ForbiddenException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      !this.staffAuth.hasCap(me.caps, 'crm_kpi_hub_targets', 'manage') &&
      !this.staffAuth.hasCap(me.caps, 'crm_kpi_hub', 'manage') &&
      !this.staffAuth.hasCap(me.caps, 'ai_admin', 'configure')
    ) {
      throw new ForbiddenException({ error: 'missing_cap', action: 'manage' });
    }
  }

  private async assertApprove(req: ReqWithStaff): Promise<void> {
    if (!req.staffUser) throw new ForbiddenException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      !this.staffAuth.hasCap(me.caps, 'crm_kpi_hub_targets', 'manage') &&
      !this.staffAuth.hasCap(me.caps, 'crm_kpi_hub_reports', 'approve') &&
      !this.staffAuth.hasCap(me.caps, 'crm_kpi_hub', 'manage') &&
      !this.staffAuth.hasCap(me.caps, 'ai_admin', 'configure')
    ) {
      throw new ForbiddenException({ error: 'missing_cap', action: 'approve' });
    }
  }
}
