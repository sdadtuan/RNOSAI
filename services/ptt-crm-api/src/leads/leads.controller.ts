import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { hasGdkdAssign, hasGdkdViewAllLeads } from '../staff-permissions/staff-gdkd.util';
import { StaffRbacAuditRepository } from '../staff-permissions/staff-rbac-audit.repository';
import { StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { WriteEnabledGuard } from './guards/write-enabled.guard';
import { StaffLeadsWriteGuard } from './guards/staff-leads-write.guard';
import { StaffLeadsViewGuard } from './guards/staff-leads-view.guard';
import { LeadNotInReviewQueueGuard } from '../leads-funnel/guards/lead-not-in-review-queue.guard';
import { LeadsIoService } from './leads-io.service';
import { LeadsService } from './leads.service';
import { LeadsWriteService } from './leads-write.service';
import { LeadStatusGatePatchOptions, LeadStatusGateService } from './lead-status-gate.service';
import { LeadSlaCareService } from './lead-sla-care.service';
import { ChotClosedLoopService } from './chot-closed-loop.service';
import { CopilotContextService } from './copilot-context.service';
import { SlaAutoTaskService } from './sla-auto-task.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import {
  CreateLeadV1Body,
  LeadV1,
  LeadsListResponseV1,
  PatchLeadV1Body,
  BulkAssignLeadsBody,
  BulkAssignLeadsResult,
} from './leads.types';

@Controller('api/v1/leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadsWriteService: LeadsWriteService,
    private readonly leadsIo: LeadsIoService,
    private readonly crmConfig: CrmConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly statusGate: LeadStatusGateService,
    private readonly slaCare: LeadSlaCareService,
    private readonly closedLoop: ChotClosedLoopService,
    private readonly copilotContext: CopilotContextService,
    private readonly slaAutoTask: SlaAutoTaskService,
    private readonly rbacAudit: StaffRbacAuditRepository,
    private readonly clientScope: StaffClientScopeService,
  ) {}

  @Get('lookup-options')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  listLookupOptions(@Query('kind') kind?: string) {
    const normalizedKind = kind === 'source' || kind === 'channel' ? kind : undefined;
    return this.crmConfig.listLeadLookups(normalizedKind, true);
  }

  @Get('import/template.xlsx')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async downloadImportTemplate(@Res({ passthrough: false }) res: Response) {
    const { buffer, filename } = await this.leadsIo.buildTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export.xlsx')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async exportLeads(
    @Res({ passthrough: false }) res: Response,
    @Query('client_id') clientId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('ids') ids?: string,
    @Query('hide_review_queue') hideReviewQueue?: string,
  ) {
    const truthy = (v?: string) => v === '1' || v === 'true';
    const hideExplicitFalse = hideReviewQueue === '0' || hideReviewQueue === 'false';
    const parsedIds = ids
      ? ids
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((id) => Number.isFinite(id) && id > 0)
      : undefined;

    const { buffer, filename } = await this.leadsIo.exportXlsx({
      client_id: clientId,
      status,
      source,
      channel,
      q,
      hide_review_queue: hideExplicitFalse ? false : undefined,
      ids: parsedIds?.length ? parsedIds : undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importLeads(@UploadedFile() file: Express.Multer.File) {
    return this.leadsIo.importXlsx(file);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard)
  async createLead(@Body() body: CreateLeadV1Body): Promise<LeadV1> {
    return this.leadsWriteService.createLead(body);
  }

  @Post('bulk-assign')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard)
  async bulkAssignLeads(
    @Body() body: BulkAssignLeadsBody,
    @Headers('x-ptt-actor') actor?: string,
  ): Promise<BulkAssignLeadsResult> {
    return this.leadsWriteService.bulkAssignLeads(body, actor);
  }

  @Patch(':id')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard, LeadNotInReviewQueueGuard)
  async patchLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchLeadV1Body,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-ptt-actor') actor?: string,
  ): Promise<LeadV1> {
    const gateOpts = await this.statusGateOpts(req, body);
    const lead = await this.leadsWriteService.patchLead(id, body, actor, gateOpts);
    if (body.allow_status_override && req.staffUser) {
      void this.rbacAudit.log({
        event_type: 'gdkd_status_override',
        actor_email: req.staffUser.email,
        section_id: 'crm_gdkd',
        action: 'override',
        metadata: {
          lead_id: id,
          reason: String(body.status_override_reason ?? body.audit_note ?? '').trim(),
          new_status: body.status ?? lead.status,
        },
      });
    }
    return lead;
  }

  private async statusGateOpts(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    body: PatchLeadV1Body,
  ): Promise<LeadStatusGatePatchOptions> {
    if (!body.allow_status_override) return {};
    if (req.staffAuthVia === 'internal') {
      return { allowStatusOverride: true };
    }
    if (!req.staffUser) return {};
    const me = await this.staffAuth.me(req.staffUser);
    const canAssign = hasGdkdAssign(me.caps);
    return { allowStatusOverride: canAssign };
  }

  @Get()
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async listLeads(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('client_id') clientId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('review_queue_only') reviewQueueOnly?: string,
    @Query('hide_review_queue') hideReviewQueue?: string,
    @Query('owner_id') ownerId?: string,
    @Query('unassigned_only') unassignedOnly?: string,
    @Query('lead_flow_kind') leadFlowKind?: string,
  ): Promise<LeadsListResponseV1> {
    const truthy = (v?: string) => v === '1' || v === 'true';
    const hideExplicitFalse = hideReviewQueue === '0' || hideReviewQueue === 'false';
    const flowKind =
      leadFlowKind === 'spa_operational' || leadFlowKind === 'b2b_prospect'
        ? leadFlowKind
        : undefined;

    let resolvedOwnerId = ownerId ? Number(ownerId) : undefined;
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      if (!hasGdkdViewAllLeads(me.caps)) {
        const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
        if (staffId != null && resolvedOwnerId == null && !truthy(unassignedOnly)) {
          resolvedOwnerId = staffId;
        }
      }
    }

    const scope = await this.clientScope.resolveForRequest(req);
    this.clientScope.assertListClientFilter(scope, clientId);

    return this.leadsService.listLeads({
      client_id: clientId,
      status,
      source,
      channel,
      q,
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
      review_queue_only: truthy(reviewQueueOnly),
      hide_review_queue: hideExplicitFalse ? false : undefined,
      owner_id: resolvedOwnerId,
      unassigned_only: truthy(unassignedOnly),
      lead_flow_kind: flowKind,
      allowed_client_ids: scope.restricted ? scope.allowedClientIds : undefined,
    });
  }

  @Get(':id/status-options')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadStatusOptions(@Param('id', ParseIntPipe) id: number) {
    return this.statusGate.getStatusOptions(id);
  }

  /** Phase 1 — SLA-aware care context (Spa Meta 24h): banner, NBA, drafts. */
  @Get(':id/sla-care-context')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadSlaCareContext(@Param('id', ParseIntPipe) id: number) {
    return this.slaCare.getCareContext(id);
  }

  /** Phase 3 — Chốt closed-loop context (VND, QA flags, hub link). */
  @Get(':id/closed-loop-context')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadClosedLoopContext(@Param('id', ParseIntPipe) id: number) {
    return this.closedLoop.getLeadContext(id);
  }

  /** Unified copilot context — flow_kind, SLA, funnel, activities, catalog, drafts. */
  @Get(':id/copilot-context')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadCopilotContext(@Param('id', ParseIntPipe) id: number) {
    return this.copilotContext.getContext(id);
  }

  /** Phase 3 — Track AI call script copy for playbook A/B. */
  @Post(':id/closed-loop/script-copy')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  trackCallScriptCopy(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const actor = String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
    return this.closedLoop.trackCallScriptCopy(id, actor, 'ai_v1').then(() => ({ ok: true }));
  }

  /** E2 — safe SLA reminder activity (BR-AI-01: internal note only). */
  @Post(':id/sla-auto-task')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  async createSlaAutoTask(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h';
      suggested_action: 'log_call' | 'complete_b2' | 'set_chot_audit' | 'set_lost_reason' | 'reassign';
      message?: string;
    },
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const actor = String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
    const userId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.slaAutoTask.createReminder(id, body, actor, userId);
  }

  @Get(':id')
  @UseGuards(StaffOrInternalKeyGuard)
  async getLead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ): Promise<LeadV1> {
    const lead = await this.leadsService.getLead(id);
    if (!lead) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    const scope = await this.clientScope.resolveForRequest(req);
    this.clientScope.assertLeadAccessible(scope, lead.client_id);
    return lead;
  }
}
