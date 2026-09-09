import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import {
  StaffKpiHubDictionaryManageGuard,
  StaffKpiHubDictionaryPublishGuard,
  StaffKpiHubDictionaryViewGuard,
  StaffKpiHubViewGuard,
} from '../guards/staff-kpi-hub.guard';
import { ServiceKpiInstancesService } from './service-kpi-instances.service';
import { ServiceKpiOperationsService } from './service-kpi-operations.service';
import { ServiceKpiRepository } from './service-kpi.repository';
import { ServiceKpiTemplatesService } from './service-kpi-templates.service';
import { ServiceKpiQuoteScoreService } from './service-kpi-quote-score';
import type {
  CreateInstanceBody,
  CreateTemplateBody,
  ImportActualRow,
  IngestActualBody,
  PatchInstanceBody,
} from './service-kpi.types';

type AuthedReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/kpi-hub')
@UseGuards(StaffOrInternalKeyGuard)
export class ServiceKpiController {
  constructor(
    private readonly templates: ServiceKpiTemplatesService,
    private readonly repo: ServiceKpiRepository,
    private readonly instances: ServiceKpiInstancesService,
    private readonly operations: ServiceKpiOperationsService,
    private readonly quoteScore: ServiceKpiQuoteScoreService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private parseRowVersion(header: string | undefined): number {
    const raw = String(header ?? '').trim();
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return 0;
    return n;
  }

  private async actor(req: AuthedReq) {
    if (req.staffAuthVia === 'internal') return { staffId: 1, hasFinance: true };
    if (!req.staffUser) return { staffId: 0, hasFinance: false };
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = (await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0;
    return {
      staffId,
      hasFinance: this.staffAuth.hasCap(me.caps, 'crm_quote', 'finance'),
    };
  }

  @Get('service-templates')
  @UseGuards(StaffKpiHubViewGuard)
  listTemplates(
    @Query('dv_code') dvCode?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.templates.list({
      dv_code: dvCode,
      status,
      page: page ? Number(page) : undefined,
      page_size: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('service-templates')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  async createTemplate(@Body() body: CreateTemplateBody, @Req() req: AuthedReq) {
    return this.templates.create(body, await this.actor(req));
  }

  @Get('service-templates/:id')
  @UseGuards(StaffKpiHubViewGuard)
  getTemplate(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Post('service-templates/:id/versions')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  async createRevision(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.templates.createRevision(id, await this.actor(req));
  }

  @Post('service-template-versions/:id/submit')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  submitReview(@Param('id') versionId: string) {
    return this.templates.submitReview(versionId);
  }

  @Post('service-template-versions/:id/activate')
  @UseGuards(StaffKpiHubDictionaryPublishGuard)
  activate(@Param('id') versionId: string) {
    return this.templates.activate(versionId);
  }

  @Patch('service-template-versions/:id/rules')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  updateVersionRules(
    @Param('id') versionId: string,
    @Body() body: { rules: CreateTemplateBody['rules'] },
  ) {
    return this.templates.updateVersionRules(versionId, body.rules ?? []);
  }

  @Get('policy-packs')
  @UseGuards(StaffKpiHubViewGuard)
  listPolicyPacks() {
    return this.repo.listPolicyPacks();
  }

  @Get('policy-packs/:industry')
  @UseGuards(StaffKpiHubViewGuard)
  async getPolicyPack(@Param('industry') industry: string) {
    const pack = await this.repo.getPolicyPack(industry);
    if (!pack) return { error: 'PACK_NOT_FOUND' };
    return pack;
  }

  @Post('instances')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  createInstance(@Body() body: CreateInstanceBody) {
    return this.instances.create(body);
  }

  @Get('instances')
  @UseGuards(StaffKpiHubViewGuard)
  listInstances(
    @Query('source_type') sourceType?: string,
    @Query('source_id') sourceId?: string,
    @Query('status') status?: string,
    @Query('dv_code') dvCode?: string,
  ) {
    return this.instances.list({
      source_type: sourceType,
      source_id: sourceId,
      status,
      dv_code: dvCode,
    });
  }

  @Get('instances/:id')
  @UseGuards(StaffKpiHubViewGuard)
  getInstance(@Param('id') id: string) {
    return this.instances.get(id);
  }

  @Patch('instances/:id')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  patchInstance(
    @Param('id') id: string,
    @Body() body: PatchInstanceBody,
    @Headers('if-match') ifMatch?: string,
  ) {
    const rowVersion = this.parseRowVersion(ifMatch);
    if (!rowVersion) throw new BadRequestException({ error: 'if_match_required' });
    return this.instances.patch(id, body, rowVersion);
  }

  @Post('instances/:id/validate-readiness')
  @UseGuards(StaffKpiHubViewGuard)
  validateInstanceReadiness(@Param('id') id: string) {
    return this.instances.validateReadiness(id);
  }

  @Get('instances/:id/measurement-plan')
  @UseGuards(StaffKpiHubViewGuard)
  getMeasurementPlan(@Param('id') id: string) {
    return this.operations.getMeasurementPlan(id);
  }

  @Post('instances/:id/measurement-plan')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  upsertMeasurementPlan(
    @Param('id') id: string,
    @Body()
    body: {
      owner_name: string;
      cadence?: string;
      data_source?: string;
      field_mapping?: string;
      freshness_sla_hours?: number;
    },
  ) {
    return this.operations.upsertMeasurementPlan(id, body);
  }

  @Post('instances/:id/actuals')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  ingestActual(@Param('id') id: string, @Body() body: IngestActualBody) {
    return this.operations.ingestActual(id, body);
  }

  @Get('instances/:id/actuals')
  @UseGuards(StaffKpiHubViewGuard)
  listActuals(@Param('id') id: string) {
    return this.operations.listActuals(id);
  }

  @Post('actuals/import')
  @UseGuards(StaffKpiHubDictionaryManageGuard)
  importActuals(@Body() body: { rows?: ImportActualRow[] }) {
    return this.operations.importActualsBatch(body.rows ?? []);
  }

  @Get('service-kpi/contract-risk')
  @UseGuards(StaffKpiHubViewGuard)
  contractRisk(@Query('version_id') versionId?: string, @Query('gm_bps') gmBps?: string) {
    if (versionId?.trim()) {
      const gm = gmBps != null && gmBps !== '' ? Number(gmBps) : null;
      return this.quoteScore.scoreForVersion(versionId.trim(), gm);
    }
    return this.operations.listContractRisk();
  }

  @Get('service-kpi/contract-quotes')
  @UseGuards(StaffKpiHubViewGuard)
  contractQuotes() {
    return this.operations.listQuoteContractScores();
  }

  @Get('reconcile/sources')
  @UseGuards(StaffKpiHubViewGuard)
  reconcileSources() {
    return this.operations.listReconcileSources();
  }

  @Get('reconcile')
  @UseGuards(StaffKpiHubViewGuard)
  reconcile(@Query('source_id') sourceId: string) {
    return this.operations.reconcile(String(sourceId ?? ''));
  }

  @Get('service-kpi/war-room')
  @UseGuards(StaffKpiHubViewGuard)
  async warRoom(@Req() req: AuthedReq) {
    const actor = await this.actor(req);
    return this.operations.getWarRoom({ includeGm: actor.hasFinance });
  }
}
