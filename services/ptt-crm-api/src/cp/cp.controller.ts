import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { MessageEvent } from '@nestjs/common/interfaces';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  CpAssetRightsInput,
  CpAssetsService,
  CpCreateAssetInput,
  CpFinalizeAssetInput,
  CpReplaceAssetInput,
} from './cp-assets.service';
import {
  CpBrandService,
  CpCreateKitInput,
  CpCreateRuleInput,
  CpPreviewInput,
} from './cp-brand.service';
import { CpLedgerGrantInput, CpLedgerService } from './cp-ledger.service';
import { CpOverviewService } from './cp-overview.service';
import { CpRendersService } from './cp-renders.service';
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
import { CpSettingsPatch, CpSettingsService } from './cp-settings.service';
import { CpApprovalsService, CpApprovalInput, isLegalApprovalInput } from './cp-approvals.service';
import { CpCommentInput, CpCommentsService } from './cp-comments.service';
import { CpBulkInput, CpPublishInput, CpPublishService } from './cp-publish.service';
import { CpQcPackId } from './cp-playbook.types';
import { CpPlaybooksService } from './cp-playbooks.service';
import { CpReHandoffService, CpReHandoffInput } from './cp-re-handoff.service';
import { CpQcService, QcFacts } from './cp-qc.service';
import { CpSopIngestInput, CpSopIngestService } from './cp-sop-ingest.service';
import {
  CpSceneInput,
  CpTimelinePatch,
  CpVideoDraftInput,
  CpVideosService,
} from './cp-videos.service';
import {
  CpContentOsHandoffInput,
  CpContentOsHandoffService,
} from './cp-content-os-handoff.service';
import { CpTemplateInput, CpTemplateUseInput, CpTemplatesService } from './cp-templates.service';
import { CpBatchInput, CpBatchItemPatch, CpBatchesService } from './cp-batches.service';
import {
  CpCollectionInput,
  CpCollectionItemInput,
  CpCollectionsService,
} from './cp-collections.service';
import { CpReportExportInput, CpReportsService } from './cp-reports.service';
import {
  CpExperimentInput,
  CpExperimentVariantInput,
  CpExperimentsService,
} from './cp-experiments.service';
import { readAiOpsFlags } from './cp-ai-ops.flags';
import { CpWeaveCreateInput, CpWeaveService } from './cp-weave.service';
import { CpProviderConnectionsService } from './cp-provider-connections.service';
import { CpJobDraftInput, CpJobsService } from './cp-jobs.service';
import {
  RequireCpAction,
  RequireCpSection,
  StaffCpGuard,
} from './guards/staff-cp.guard';

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
    private readonly brand: CpBrandService,
    private readonly videos: CpVideosService,
    private readonly qc: CpQcService,
    private readonly comments: CpCommentsService,
    private readonly approvals: CpApprovalsService,
    private readonly renders: CpRendersService,
    private readonly ledger: CpLedgerService,
    private readonly settings: CpSettingsService,
    private readonly staffAuth: StaffAuthService,
    private readonly publish: CpPublishService,
    private readonly contentOs: CpContentOsHandoffService,
    private readonly templates: CpTemplatesService,
    private readonly batches: CpBatchesService,
    private readonly collections: CpCollectionsService,
    private readonly reports: CpReportsService,
    private readonly experiments: CpExperimentsService,
    private readonly playbooks: CpPlaybooksService,
    private readonly reHandoff: CpReHandoffService,
    private readonly sopIngest: CpSopIngestService,
    private readonly weave: CpWeaveService,
    private readonly connections: CpProviderConnectionsService,
    @Optional() private readonly jobs?: CpJobsService,
  ) {}

  private async assertReportExportCap(req: AuthedReq) {
    if (req.staffAuthVia === 'internal') return;
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const canExportFinal = Boolean(me && this.staffAuth.hasCap(me.caps, 'crm_cp.export_final', 'execute'));
    const canFinanceView = Boolean(me && this.staffAuth.hasCap(me.caps, 'crm_cp.finance', 'view'));
    const canView = Boolean(
      me
      && (this.staffAuth.hasCap(me.caps, 'crm_cp', 'view')
        || this.staffAuth.hasCap(me.caps, 'crm_cp', 'view_all')),
    );
    if (canExportFinal || (canFinanceView && canView)) return;
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_cp.export_final',
      action: 'execute',
    });
  }

  private async assertLegalApprovalCap(req: AuthedReq, input: CpApprovalInput) {
    if (!isLegalApprovalInput(input)) return;
    if (req.staffAuthVia === 'internal') return;
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    if (!me || !this.staffAuth.hasCap(me.caps, 'crm_cp.approve_legal', 'execute')) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_cp.approve_legal',
        action: 'execute',
      });
    }
  }

  private requireJobs(): CpJobsService {
    if (!this.jobs) {
      throw new ForbiddenException({ error: 'jobs_unavailable' });
    }
    return this.jobs;
  }

  private async hasHighCostCap(req: AuthedReq): Promise<boolean> {
    if (req.staffAuthVia === 'internal') return true;
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    return Boolean(me && this.staffAuth.hasCap(me.caps, 'crm_cp.render_high_cost', 'execute'));
  }

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

  @Get('reports/:slug')
  @RequireCpAction('view')
  async getReport(
    @Req() req: AuthedReq,
    @Param('slug') slug: string,
    @Query() query: OverviewQuery & {
      project?: string;
      channel?: string;
      model?: string;
      template?: string;
      creator?: string;
    },
  ) {
    return this.reports.get(slug, {
      ...(await this.scope(req, query.scope)),
      from: query.from,
      to: query.to,
      client: query.client,
      lifecycle: query.lifecycle,
      project: query.project,
      channel: query.channel,
      model: query.model,
      template: query.template,
      creator: query.creator,
    });
  }

  @Post('reports/export')
  @RequireCpAction('view')
  async exportReport(
    @Req() req: AuthedReq,
    @Body() body: CpReportExportInput,
    @Query('scope') scope?: CpScope,
  ) {
    await this.assertReportExportCap(req);
    return this.reports.export(body ?? {}, await this.scope(req, scope));
  }

  @Get('settings')
  @RequireCpAction('view')
  getSettings() {
    return this.settings.get();
  }

  @Get('ai-ops/flags')
  @RequireCpAction('view')
  flags() {
    return readAiOpsFlags();
  }

  @Get('provider-connections')
  @RequireCpAction('view')
  listProviderConnections() {
    return this.connections.list();
  }

  @Post('provider-connections/magnific/oauth/start')
  @RequireCpAction('manage')
  async startMagnificOAuth(@Req() req: AuthedReq) {
    const actor = await this.scope(req);
    return this.connections.startMagnificOAuth(actor.staffId);
  }

  @Post('provider-connections/magnific/rest-key')
  @RequireCpAction('manage')
  async saveMagnificRestKey(
    @Req() req: AuthedReq,
    @Body() body: { api_key?: string },
  ) {
    const actor = await this.scope(req);
    return this.connections.saveRestKey(actor.staffId, body ?? {});
  }

  @Post('provider-connections/:id/disconnect')
  @RequireCpAction('manage')
  async disconnectProviderConnection(
    @Req() req: AuthedReq,
    @Param('id') id: string,
  ) {
    await this.scope(req);
    return this.connections.disconnect(id);
  }

  @Post('jobs/draft')
  @RequireCpAction('edit')
  async draftJob(@Req() req: AuthedReq, @Body() body: CpJobDraftInput) {
    const actor = await this.scope(req);
    return this.requireJobs().draft(actor.staffId, body ?? {}, {
      hasHighCostCap: await this.hasHighCostCap(req),
    });
  }

  @Post('jobs/:id/confirm')
  @RequireCpSection('crm_cp.render', 'execute')
  async confirmJob(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { confirm?: boolean },
  ) {
    const actor = await this.scope(req);
    return this.requireJobs().confirm(actor.staffId, id, { confirm: body?.confirm === true });
  }

  @Post('jobs/:id/submit')
  @RequireCpSection('crm_cp.render', 'execute')
  async submitJob(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.scope(req);
    return this.requireJobs().submit(actor.staffId, id);
  }

  @Post('jobs/:id/cancel')
  @RequireCpSection('crm_cp.render', 'execute')
  async cancelJob(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.scope(req);
    return this.requireJobs().cancel(actor.staffId, id);
  }

  @Post('jobs/:id/retry')
  @RequireCpSection('crm_cp.render', 'execute')
  async retryJob(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.scope(req);
    return this.requireJobs().retry(actor.staffId, id);
  }

  @Get('jobs/:id')
  @RequireCpAction('view')
  async getJob(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.scope(req);
    return this.requireJobs().get(actor.staffId, id);
  }

  @Patch('settings')
  @RequireCpAction('manage')
  async patchSettings(
    @Req() req: AuthedReq,
    @Body() body: CpSettingsPatch,
  ) {
    const actor = await this.scope(req);
    return this.settings.patch(
      body ?? {},
      actor.staffId > 0 ? actor.staffId : null,
    );
  }

  @Get('publish/profiles')
  @RequireCpAction('view')
  listPublishProfiles() {
    return this.publish.listProfiles();
  }

  @Get('publish/versions')
  @RequireCpAction('view')
  async listPublishVersions(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.publish.listVersions(await this.scope(req, scope));
  }

  @Get('publish/gate/:versionId')
  @RequireCpAction('view')
  async getPublishGate(
    @Req() req: AuthedReq,
    @Param('versionId') versionId: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.publish.getGate(versionId, await this.scope(req, scope));
  }

  @Get('publish')
  @RequireCpAction('view')
  async listPublishItems(
    @Req() req: AuthedReq,
    @Query() query: {
      scope?: CpScope;
      channel?: string;
      client?: string;
      project?: string;
      approval?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.publish.list({
      ...(await this.scope(req, query.scope)),
      channel: query.channel,
      client: query.client,
      project: query.project,
      approval: query.approval,
      from: query.from,
      to: query.to,
    });
  }

  @Post('publish')
  @RequireCpAction('edit')
  async schedulePublish(
    @Req() req: AuthedReq,
    @Body() body: CpPublishInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.publish.schedule(body ?? {}, await this.scope(req, scope));
  }

  @Post('publish/bulk')
  @RequireCpSection('crm_cp.publish', 'execute')
  async bulkPublish(
    @Req() req: AuthedReq,
    @Body() body: CpBulkInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.publish.bulkSchedule(body ?? {}, await this.scope(req, scope));
  }

  @Post('publish/:id/deliver')
  @RequireCpSection('crm_cp.publish', 'execute')
  async deliverPublish(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.publish.deliver(id, await this.scope(req, scope));
  }

  @Post('publish/:id/retry')
  @RequireCpSection('crm_cp.publish', 'execute')
  async retryPublish(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.publish.retry(id, await this.scope(req, scope));
  }

  @Get('publish/:id/history')
  @RequireCpAction('view')
  async publishHistory(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.publish.listHistory(id, await this.scope(req, scope));
  }

  @Post('credits/grant')
  @RequireCpSection('crm_cp.finance', 'execute')
  grantCredits(
    @Body() body: CpLedgerGrantInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ledger.grant(body ?? {}, idempotencyKey ?? '');
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

  @Post('assets/:id/replace')
  @RequireCpAction('edit')
  async replaceAsset(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpReplaceAssetInput,
  ) {
    return this.assets.replaceFile(id, body ?? {}, await this.scope(req));
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

  @Get('brand-kits')
  @RequireCpAction('view')
  async listBrandKits(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.brand.listKits(await this.scope(req, scope));
  }

  @Post('brand-kits')
  @RequireCpAction('edit')
  async createBrandKit(@Req() req: AuthedReq, @Body() body: CpCreateKitInput) {
    return this.brand.createKit(body ?? {}, await this.scope(req));
  }

  @Get('brand-kits/:id/versions')
  @RequireCpAction('view')
  async listBrandKitVersions(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.brand.listVersions(id, await this.scope(req, scope));
  }

  @Post('brand-kits/:id/versions')
  @RequireCpAction('edit')
  async saveBrandKitVersion(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.brand.saveVersion(id, body ?? {}, await this.scope(req));
  }

  @Post('brand-kits/:id/versions/:n/restore')
  @RequireCpAction('edit')
  async restoreBrandKitVersion(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('n') n: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.brand.restoreVersion(id, Number(n), await this.scope(req, scope));
  }

  @Get('brand-kits/:id/rules')
  @RequireCpAction('view')
  async listBrandRules(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
    @Query('n') n?: string,
  ) {
    return this.brand.listRules(
      id,
      await this.scope(req, scope),
      n == null || n === '' ? undefined : Number(n),
    );
  }

  @Post('brand-kits/:id/rules')
  @RequireCpSection('crm_cp.manage_brand_rule', 'manage')
  async createBrandRule(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpCreateRuleInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.brand.createRule(id, body ?? {}, await this.scope(req, scope));
  }

  @Post('brand-kits/:id/preview')
  @RequireCpAction('view')
  async previewBrandKit(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpPreviewInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.brand.preview(id, body ?? {}, await this.scope(req, scope));
  }

  @Get('brand-kits/:id')
  @RequireCpAction('view')
  async getBrandKit(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.brand.getKit(id, await this.scope(req, scope));
  }

  @Get('playbooks')
  @RequireCpAction('view')
  listPlaybooks() {
    return this.playbooks.list();
  }

  @Get('playbooks/:id')
  @RequireCpAction('view')
  getPlaybook(@Param('id') id: string) {
    return this.playbooks.get(id);
  }

  @Post('playbooks/:id/clone-template')
  @RequireCpAction('edit')
  clonePlaybookTemplate(
    @Param('id') id: string,
    @Body() body: { name?: string; agency_client_id?: string | null },
  ) {
    return this.playbooks.cloneToTemplate(id, body ?? {});
  }

  @Post('playbooks/:id/run')
  @RequireCpAction('edit')
  async runPlaybook(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Query('scope') scope?: CpScope,
  ) {
    const actor = await this.scope(req, scope);
    return this.playbooks.run(id, body ?? {}, actor, actor.staffId);
  }

  @Post('re-projects/:id/cp-handoff')
  @RequireCpAction('edit')
  async reProjectCpHandoff(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpReHandoffInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.reHandoff.handoff(id, body ?? {}, await this.scope(req, scope));
  }

  @Get('videos')
  @RequireCpAction('view')
  async listVideos(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.videos.list(await this.scope(req, scope));
  }

  @Post('videos')
  @RequireCpAction('edit')
  async createVideo(@Req() req: AuthedReq, @Body() body: CpVideoDraftInput) {
    return this.videos.upsertDraft(body ?? {}, await this.scope(req));
  }

  @Post('content-os/handoff')
  @RequireCpAction('edit')
  async contentOsHandoff(@Req() req: AuthedReq, @Body() body: CpContentOsHandoffInput) {
    return this.contentOs.handoff(body ?? {}, await this.scope(req));
  }

  @Post('videos/sop-ingest')
  @RequireCpAction('edit')
  async sopVideoIngest(@Req() req: AuthedReq, @Body() body: CpSopIngestInput) {
    return this.sopIngest.ingestFromSop(body ?? {}, await this.scope(req));
  }

  @Get('videos/versions/:id')
  @RequireCpAction('view')
  async getVideoVersion(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.videos.getVersion(id, await this.scope(req, scope));
  }

  @Post('videos/versions/:id/qc')
  @RequireCpAction('edit')
  async runVideoQc(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: QcFacts & { facts?: QcFacts; pack?: CpQcPackId },
    @Query('scope') scope?: CpScope,
  ) {
    const payload = body ?? {};
    const { pack, ...factsBody } = payload;
    return this.qc.run(
      id,
      qcFactsFrom(factsBody),
      await this.scope(req, scope),
      pack ? { pack } : {},
    );
  }

  @Post('videos/versions/:id/export')
  @RequireCpSection('crm_cp.export_final', 'execute')
  async exportVideoVersion(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.qc.exportFinal(id, await this.scope(req, scope));
  }

  @Get('videos/versions/:id/comments')
  @RequireCpAction('view')
  async listVideoComments(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.comments.list(id, await this.scope(req, scope));
  }

  @Post('videos/versions/:id/comments')
  @RequireCpAction('edit')
  async createVideoComment(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpCommentInput,
    @Query('scope') scope?: CpScope,
  ) {
    const actor = await this.scope(req, scope);
    return this.comments.create(id, body ?? {}, actor.staffId, actor);
  }

  @Post('videos/versions/:id/approvals')
  @RequireCpAction('edit')
  async submitVideoApproval(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpApprovalInput,
    @Query('scope') scope?: CpScope,
  ) {
    // Body-dependent equivalent of @RequireCpSection('crm_cp.approve_legal', 'execute')
    await this.assertLegalApprovalCap(req, body ?? {});
    const actor = await this.scope(req, scope);
    return this.approvals.submit(id, body ?? {}, actor.staffId, actor);
  }

  @Get('videos/versions/:id/compare/:otherId')
  @RequireCpAction('view')
  async compareVideoVersions(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('otherId') otherId: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.approvals.compareVersions(id, otherId, await this.scope(req, scope));
  }

  @Get('videos/:id/scenes')
  @RequireCpAction('view')
  async listVideoScenes(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.videos.listScenes(id, await this.scope(req, scope));
  }

  @Put('videos/:id/scenes')
  @RequireCpAction('edit')
  async putVideoScenes(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { scenes?: CpSceneInput[] },
    @Query('scope') scope?: CpScope,
  ) {
    return this.videos.putScenes(id, body ?? {}, await this.scope(req, scope));
  }

  @Patch('videos/:id/timeline')
  @RequireCpAction('edit')
  async patchVideoTimeline(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpTimelinePatch,
    @Query('scope') scope?: CpScope,
  ) {
    return this.videos.patchTimeline(id, body ?? {}, await this.scope(req, scope));
  }

  @Post('videos/:id/scenes/:n/regenerate')
  @RequireCpAction('edit')
  async regenerateVideoScene(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('n') n: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.videos.regenerateScene(id, n, await this.scope(req, scope));
  }

  @Post('videos/:id/auto-script')
  @RequireCpAction('edit')
  async autoScriptVideo(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.videos.autoScript(id, await this.scope(req, scope));
  }

  @Get('videos/:id')
  @RequireCpAction('view')
  async getVideo(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.videos.get(id, await this.scope(req, scope));
  }

  @Patch('videos/:id')
  @RequireCpAction('edit')
  async patchVideo(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpVideoDraftInput,
  ) {
    return this.videos.patchDraft(id, body ?? {}, await this.scope(req));
  }

  @Post('videos/:id/render')
  @RequireCpSection('crm_cp.render', 'execute')
  async renderVideo(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.renders.submit(id, idempotencyKey ?? '', await this.scope(req));
  }

  @Get('renders')
  @RequireCpAction('view')
  async listRenders(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.renders.list(await this.scope(req, scope));
  }

  @Get('renders/:id')
  @RequireCpAction('view')
  async getRender(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.renders.get(id, await this.scope(req, scope));
  }

  @Get('renders/:id/events')
  @RequireCpAction('view')
  @Sse()
  async renderEvents(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ): Promise<Observable<MessageEvent>> {
    return this.renders.streamEvents(id, await this.scope(req, scope));
  }

  @Post('renders/:id/retry')
  @RequireCpSection('crm_cp.render', 'execute')
  async retryRender(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.renders.retryJob(id, await this.scope(req));
  }

  @Post('renders/:id/cancel')
  @RequireCpSection('crm_cp.render', 'execute')
  async cancelRender(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.renders.cancelJob(id, await this.scope(req));
  }

  @Get('projects/lookups')
  @RequireCpAction('view')
  async projectLookups() {
    return this.projects.lookups();
  }

  @Get('projects')
  @RequireCpAction('view')
  async listProjects(
    @Req() req: AuthedReq,
    @Query() query: {
      scope?: CpScope;
      status?: string;
      q?: string;
      cursor?: string;
      client?: string;
      owner?: string;
      lifecycle?: string;
    },
  ) {
    return this.projects.list({
      ...(await this.scope(req, query.scope)),
      status: query.status,
      q: query.q,
      cursor: query.cursor,
      client: query.client,
      owner: query.owner,
      lifecycle: query.lifecycle,
    });
  }

  @Post('projects')
  @RequireCpAction('edit')
  async createProject(@Req() req: AuthedReq, @Body() body: CpCreateProjectInput) {
    const actor = await this.scope(req);
    return this.projects.create(body ?? {}, actor.staffId > 0 ? actor.staffId : null);
  }

  @Post('projects/import-b2b')
  @RequireCpAction('edit')
  async importProjectsFromB2b(@Req() req: AuthedReq) {
    const actor = await this.scope(req);
    return this.projects.importFromB2b(actor.staffId);
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

  @Post('projects/:id/submit-creative')
  @RequireCpAction('edit')
  async submitCreative(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { version_id?: string },
    @Query('scope') scope?: CpScope,
  ) {
    return this.projects.submitCreative(
      id,
      body?.version_id,
      await this.scope(req, scope),
    );
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

  @Get('templates')
  @RequireCpAction('view')
  listTemplates() {
    return this.templates.list();
  }

  @Post('templates')
  @RequireCpAction('edit')
  createTemplate(@Body() body: CpTemplateInput) {
    return this.templates.create(body ?? {});
  }

  @Get('templates/:id')
  @RequireCpAction('view')
  getTemplate(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Post('templates/:id/publish')
  @RequireCpAction('edit')
  publishTemplate(@Param('id') id: string) {
    return this.templates.publish(id);
  }

  @Post('templates/:id/use')
  @RequireCpAction('edit')
  async useTemplate(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpTemplateUseInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.templates.use(id, body ?? {}, await this.scope(req, scope));
  }

  @Get('batches')
  @RequireCpAction('view')
  async listBatches(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.batches.list(await this.scope(req, scope));
  }

  @Post('batches')
  @RequireCpAction('edit')
  async createBatch(
    @Req() req: AuthedReq,
    @Body() body: CpBatchInput,
    @Query('scope') scope?: CpScope,
  ) {
    const actor = await this.scope(req, scope);
    return this.batches.create(body ?? {}, actor.staffId, actor);
  }

  @Get('batches/:id/errors.csv')
  @RequireCpAction('view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async batchErrorsCsv(
    @Req() req: AuthedReq,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    const csv = await this.batches.errorsCsv(id, await this.scope(req, scope));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  }

  @Post('batches/:id/validate')
  @RequireCpAction('edit')
  async validateBatch(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.batches.validate(id, await this.scope(req, scope));
  }

  @Post('batches/:id/run')
  @RequireCpSection('crm_cp.render', 'execute')
  async runBatch(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.batches.run(id, await this.scope(req, scope));
  }

  @Patch('batches/:id/items/:rowNo')
  @RequireCpAction('edit')
  async patchBatchItem(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('rowNo') rowNo: string,
    @Body() body: CpBatchItemPatch,
    @Query('scope') scope?: CpScope,
  ) {
    return this.batches.patchItem(id, rowNo, body ?? {}, await this.scope(req, scope));
  }

  @Post('batches/:id/items/:rowNo/retry')
  @RequireCpSection('crm_cp.render', 'execute')
  async retryBatchItem(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('rowNo') rowNo: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.batches.retryItem(id, rowNo, await this.scope(req, scope));
  }

  @Get('batches/:id')
  @RequireCpAction('view')
  async getBatch(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.batches.get(id, await this.scope(req, scope));
  }

  @Get('collections')
  @RequireCpAction('view')
  async listCollections(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.collections.list(await this.scope(req, scope));
  }

  @Post('collections')
  @RequireCpAction('edit')
  async createCollection(@Req() req: AuthedReq, @Body() body: CpCollectionInput) {
    const actor = await this.scope(req);
    return this.collections.create(body ?? {}, actor.staffId);
  }

  @Get('collections/:id')
  @RequireCpAction('view')
  async getCollection(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.collections.get(id, await this.scope(req, scope));
  }

  @Post('collections/:id/items')
  @RequireCpAction('edit')
  async addCollectionItem(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpCollectionItemInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.collections.addItem(id, body ?? {}, await this.scope(req, scope));
  }

  @Delete('collections/:id/items/:assetId')
  @RequireCpAction('edit')
  async removeCollectionItem(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.collections.removeItem(id, assetId, await this.scope(req, scope));
  }

  @Get('quality')
  @RequireCpAction('view')
  async getQuality(@Req() req: AuthedReq, @Query('scope') scope?: CpScope) {
    return this.collections.quality(await this.scope(req, scope));
  }

  @Get('projects/:id/experiments')
  @RequireCpAction('view')
  async listProjectExperiments(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.experiments.list(id, await this.scope(req, scope));
  }

  @Post('projects/:id/experiments')
  @RequireCpAction('edit')
  async createProjectExperiment(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpExperimentInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.experiments.create(
      { ...(body ?? {}), project_id: id },
      await this.scope(req, scope),
    );
  }

  @Get('experiments/:id')
  @RequireCpAction('view')
  async getExperiment(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Query('scope') scope?: CpScope,
  ) {
    return this.experiments.get(id, await this.scope(req, scope));
  }

  @Post('experiments/:id/variants')
  @RequireCpAction('edit')
  async createExperimentVariant(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: CpExperimentVariantInput,
    @Query('scope') scope?: CpScope,
  ) {
    return this.experiments.createVariant(id, body ?? {}, await this.scope(req, scope));
  }

  @Post('weave-orders')
  @RequireCpAction('edit')
  async createWeaveOrder(@Req() req: AuthedReq, @Body() body: CpWeaveCreateInput) {
    const actor = await this.scope(req);
    return this.weave.create(body ?? {}, actor.staffId);
  }

  @Get('weave-orders')
  @RequireCpAction('view')
  listWeaveOrders(@Query('project_id') projectId: string) {
    return this.weave.list(projectId);
  }

  @Get('weave-orders/:id')
  @RequireCpAction('view')
  getWeaveOrder(@Param('id') id: string) {
    return this.weave.get(id);
  }

  @Post('weave-orders/:id/generate-brief')
  @RequireCpAction('edit')
  generateWeaveBrief(@Param('id') id: string) {
    return this.weave.generateBrief(id);
  }

  @Post('weave-orders/:id/open')
  @RequireCpAction('edit')
  async openWeaveOrder(@Req() req: AuthedReq, @Param('id') id: string) {
    const actor = await this.scope(req);
    return this.weave.open(id, actor.staffId);
  }

  @Post('weave-orders/:id/assets')
  @RequireCpAction('edit')
  addWeaveAsset(
    @Param('id') id: string,
    @Body() body: { storage_uri?: string; source?: string },
  ) {
    return this.weave.addAsset(id, body ?? {});
  }

  @Post('weave-orders/:id/sync-output')
  @RequireCpAction('edit')
  syncWeaveOutput(
    @Param('id') id: string,
    @Body() body: { include_drafts?: boolean },
  ) {
    return this.weave.syncOutput(id, body ?? {});
  }

  @Post('weave-orders/:id/submit-review')
  @RequireCpAction('edit')
  async submitWeaveReview(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.weave.submitReview(id, await this.scope(req));
  }

  @Post('weave-orders/:id/deliver')
  @RequireCpSection('crm_cp.export_final', 'execute')
  deliverWeaveOrder(@Param('id') id: string) {
    return this.weave.deliver(id);
  }
}

function qcFactsFrom(body: (QcFacts & { facts?: QcFacts }) | undefined): QcFacts {
  const payload = body ?? {};
  if (payload.facts && typeof payload.facts === 'object' && !Array.isArray(payload.facts)) {
    return payload.facts;
  }
  const { facts: _facts, ...facts } = payload;
  return facts;
}
