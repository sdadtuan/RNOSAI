import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  CpAssetRightsInput,
  CpAssetsService,
  CpCreateAssetInput,
  CpFinalizeAssetInput,
} from './cp-assets.service';
import { CpOverviewService } from './cp-overview.service';
import {
  CpBriefInput,
  CpCloseProjectInput,
  CpCreateProjectInput,
  CpDeliverableInput,
  CpPatchProjectInput,
  CpProjectsService,
  CpTaskInput,
} from './cp-projects.service';
import { CpScope, resolveCpScope } from './cp-scope.util';
import { RequireCpAction, StaffCpGuard } from './guards/staff-cp.guard';

type AuthedReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

type OverviewQuery = {
  scope?: CpScope;
  from?: string;
  to?: string;
  client?: string;
  lifecycle?: string;
  owner?: string;
  cursor?: string;
};

@Controller('api/crm/cp')
@UseGuards(StaffOrInternalKeyGuard, StaffCpGuard)
export class CpController {
  constructor(
    private readonly overview: CpOverviewService,
    private readonly projects: CpProjectsService,
    private readonly assets: CpAssetsService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async scope(req: AuthedReq, requested?: CpScope) {
    if (req.staffAuthVia === 'internal' && !req.staffUser) {
      return { scope: requested ?? ('all' as const), staffId: 0, teamIds: [] };
    }
    const staffId = req.staffUser
      ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser)
      : null;
    if (staffId == null || staffId <= 0) {
      throw new ForbiddenException({ error: 'cp_unresolved_staff' });
    }
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const has = (action: string) =>
      me ? this.staffAuth.hasCap(me.caps, 'crm_cp', action) : false;
    return {
      scope: resolveCpScope({
        requested,
        hasViewAll: has('view_all') || has('manage'),
        canTeam: has('edit') || has('manage'),
      }),
      staffId,
      teamIds: me?.teams?.map((team) => team.id) ?? [],
    };
  }

  @Get('overview/kpis')
  @RequireCpAction('view')
  async kpis(@Req() req: AuthedReq, @Query() query: OverviewQuery) {
    return this.overview.getKpis({
      ...(await this.scope(req, query.scope)),
      from: query.from,
      to: query.to,
      clientId: query.client,
      lifecycleId: query.lifecycle,
      ownerId: query.owner,
    });
  }

  @Get('overview/actions')
  @RequireCpAction('view')
  async actions(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.overview.getActions(await this.scope(req, scope));
  }

  @Get('overview/health')
  @RequireCpAction('view')
  health() {
    return this.overview.getHealth();
  }

  @Get('activity')
  @RequireCpAction('view')
  async activity(@Req() req: AuthedReq, @Query() query: OverviewQuery) {
    return this.overview.listActivity({
      ...(await this.scope(req, query.scope)),
      cursor: query.cursor,
    });
  }

  @Get('assets')
  @RequireCpAction('view')
  async listAssets(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.assets.listAssets(await this.scope(req, scope));
  }

  @Post('assets')
  @RequireCpAction('edit')
  async createAsset(@Req() req: AuthedReq, @Body() body: CpCreateAssetInput) {
    return this.assets.createAsset(body ?? {}, await this.scope(req));
  }

  @Get('assets/:id/usage')
  @RequireCpAction('view')
  async assetUsage(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.assets.usageGraph(id, await this.scope(req, scope));
  }

  @Post('assets/:id/rights')
  @RequireCpAction('edit')
  async setAssetRights(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpAssetRightsInput,
  ) {
    return this.assets.setRights(id, body ?? {}, await this.scope(req));
  }

  @Post('assets/:id/finalize')
  @RequireCpAction('edit')
  async finalizeAsset(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpFinalizeAssetInput,
  ) {
    return this.assets.finalizeIngest(id, body ?? {}, await this.scope(req));
  }

  @Get('assets/:id')
  @RequireCpAction('view')
  async getAsset(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.assets.getAsset(id, await this.scope(req, scope));
  }

  @Get('projects')
  @RequireCpAction('view')
  async listProjects(
    @Req() req: AuthedReq,
    @Query() query: { scope?: CpScope; status?: string; q?: string; cursor?: string },
  ) {
    return this.projects.list({
      ...(await this.scope(req, query.scope)),
      status: query.status,
      q: query.q,
      cursor: query.cursor,
    });
  }

  @Post('projects')
  @RequireCpAction('edit')
  async createProject(@Req() req: AuthedReq, @Body() body: CpCreateProjectInput) {
    const actor = await this.scope(req);
    return this.projects.create(body ?? {}, actor.staffId > 0 ? actor.staffId : null);
  }

  @Get('projects/:id/briefs')
  @RequireCpAction('view')
  async listBriefs(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.projects.listBriefs(id, await this.scope(req));
  }

  @Post('projects/:id/briefs')
  @RequireCpAction('edit')
  async addBrief(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpBriefInput,
  ) {
    const actor = await this.scope(req);
    return this.projects.addBrief(id, body ?? {}, actor, actor.staffId);
  }

  @Get('projects/:id/deliverables')
  @RequireCpAction('view')
  async listDeliverables(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.projects.listDeliverables(id, await this.scope(req));
  }

  @Post('projects/:id/deliverables')
  @RequireCpAction('edit')
  async addDeliverable(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpDeliverableInput,
  ) {
    return this.projects.addDeliverable(id, body ?? {}, await this.scope(req));
  }

  @Get('projects/:id/tasks')
  @RequireCpAction('view')
  async listTasks(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.projects.listTasks(id, await this.scope(req));
  }

  @Post('projects/:id/tasks')
  @RequireCpAction('edit')
  async addTask(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpTaskInput,
  ) {
    return this.projects.addTask(id, body ?? {}, await this.scope(req));
  }

  @Get('projects/:id/milestones')
  @RequireCpAction('view')
  async listMilestones(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.projects.listMilestones(id, await this.scope(req));
  }

  @Post('projects/:id/close')
  @RequireCpAction('edit')
  async closeProject(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpCloseProjectInput,
  ) {
    const actor = await this.scope(req);
    return this.projects.close(
      id,
      body ?? {},
      actor,
      actor.staffId > 0 ? actor.staffId : null,
    );
  }

  @Get('projects/:id')
  @RequireCpAction('view')
  async getProject(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.projects.get(id, await this.scope(req));
  }

  @Patch('projects/:id')
  @RequireCpAction('edit')
  async patchProject(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpPatchProjectInput,
  ) {
    return this.projects.patch(id, body ?? {}, await this.scope(req));
  }
}
